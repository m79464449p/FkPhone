import queue
import re
import threading
import time
from dataclasses import asdict, dataclass
from pathlib import Path

from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import sync_playwright

from app.services.goofish_browser_search import (
    GOOFISH_LOGIN_URL,
    GOOFISH_SEARCH_URL,
    clear_goofish_cookies,
    get_live_page,
    has_mtop_login_cookies,
    is_logged_in,
    launch_context,
    read_page_cookie_jar,
    write_cookie_file,
)


@dataclass
class LoginStatus:
    status: str = "idle"
    active: bool = False
    message: str = "尚未启动闲鱼登录。"
    screenshot_available: bool = False
    screenshot_version: int = 0


@dataclass
class LoginCommand:
    action: str
    payload: dict[str, str | float]


class GoofishLoginSession:
    def __init__(self, profile_dir: Path, screenshot_path: Path, headless: bool):
        self.profile_dir = profile_dir
        self.screenshot_path = screenshot_path
        self.headless = headless
        self._lock = threading.Lock()
        self._commands: queue.Queue[LoginCommand] = queue.Queue()
        self._stop_event = threading.Event()
        self._thread: threading.Thread | None = None
        self._status = LoginStatus()
        self._login_saved = False

    def matches(self, profile_dir: Path, screenshot_path: Path, headless: bool) -> bool:
        return self.profile_dir == profile_dir and self.screenshot_path == screenshot_path and self.headless == headless

    def start(self, timeout_seconds: int) -> dict[str, object]:
        with self._lock:
            if self._thread and self._thread.is_alive():
                return asdict(self._status)

            self.profile_dir.mkdir(parents=True, exist_ok=True)
            self.screenshot_path.parent.mkdir(parents=True, exist_ok=True)
            self.screenshot_path.unlink(missing_ok=True)
            self._commands = queue.Queue()
            self._stop_event = threading.Event()
            self._login_saved = False
            self._status = LoginStatus(status="starting", active=True, message="正在连接闲鱼登录页...")
            self._thread = threading.Thread(
                target=self._run,
                args=(timeout_seconds,),
                name="goofish-login",
                daemon=True,
            )
            self._thread.start()
            return asdict(self._status)

    def status(self) -> dict[str, object]:
        with self._lock:
            return asdict(self._status)

    def send_sms(self, phone: str) -> dict[str, object]:
        normalized = re.sub(r"\s+", "", phone)
        if not re.fullmatch(r"1\d{10}", normalized):
            raise ValueError("请输入 11 位中国大陆手机号")
        self._enqueue("send_sms", phone=normalized)
        return self.status()

    def verify(self, code: str) -> dict[str, object]:
        normalized = re.sub(r"\s+", "", code)
        if not re.fullmatch(r"\d{4,8}", normalized):
            raise ValueError("请输入短信验证码")
        self._enqueue("verify", code=normalized)
        return self.status()

    def click(self, x: float, y: float) -> dict[str, object]:
        self._enqueue("click", x=x, y=y)
        return self.status()

    def drag(self, start_x: float, start_y: float, end_x: float, end_y: float) -> dict[str, object]:
        self._enqueue("drag", start_x=start_x, start_y=start_y, end_x=end_x, end_y=end_y)
        return self.status()

    def stop(self) -> bool:
        with self._lock:
            thread = self._thread
            was_active = bool(thread and thread.is_alive())
            self._stop_event.set()
        if was_active and thread:
            thread.join(timeout=5)
        with self._lock:
            if self._status.active:
                self._status.active = False
                self._status.status = "cancelled"
                self._status.message = "已取消闲鱼登录。"
            if not thread or not thread.is_alive():
                self.screenshot_path.unlink(missing_ok=True)
                self._status.screenshot_available = False
        return was_active

    def _enqueue(self, action: str, **payload: str | float) -> None:
        with self._lock:
            if not self._thread or not self._thread.is_alive() or not self._status.active:
                raise RuntimeError("当前没有进行中的闲鱼登录")
        self._commands.put(LoginCommand(action=action, payload=payload))

    def _run(self, timeout_seconds: int) -> None:
        context = None
        try:
            with sync_playwright() as playwright:
                context = launch_context(playwright, self.profile_dir, headless=self.headless)
                page = get_live_page(context)
                clear_goofish_cookies(context)
                # Go straight to the passport page. The public search page can
                # stall in a headless server browser and prevent the QR page
                # from ever being captured.
                page.goto(GOOFISH_LOGIN_URL, wait_until="domcontentloaded", timeout=30000)
                # The desktop passport page defaults to a QR code when these
                # URL parameters are used. Do not wait for the SMS controls:
                # they belong to the fallback login mode and are not rendered
                # while the QR code is visible.
                page.wait_for_timeout(2500)
                if self._stop_event.is_set():
                    self._update("cancelled", "已取消闲鱼登录。", active=False)
                    return
                self._capture(page, "awaiting_scan", "请使用闲鱼 App 扫描下方二维码，并在手机上确认登录。")

                deadline = time.monotonic() + timeout_seconds
                while not self._stop_event.is_set() and time.monotonic() < deadline:
                    try:
                        command = self._commands.get(timeout=1)
                    except queue.Empty:
                        if is_logged_in(page):
                            self._save_login(page)
                            return
                        continue

                    self._handle_command(page, command)
                    if is_logged_in(page):
                        self._save_login(page)
                        return

                if self._stop_event.is_set():
                    self._capture(page, "cancelled", "已取消闲鱼登录。", active=False)
                else:
                    self._capture(page, "expired", "登录已超时，请重新开始。", active=False)
        except PlaywrightError as exc:
            self._update("error", f"服务器浏览器登录失败：{exc}", active=False)
        except Exception as exc:
            self._update("error", f"闲鱼登录失败：{exc}", active=False)
        finally:
            if context:
                try:
                    context.close()
                except PlaywrightError:
                    pass
            # Do not publish success until the persistent browser profile has
            # been released. The frontend starts the pending search as soon as
            # it sees success, and that search must not race this context.
            if self._login_saved:
                self._capture(None, "success", "闲鱼登录成功，可以开始搜索。", active=False)

    def _handle_command(self, page, command: LoginCommand) -> None:
        if command.action == "send_sms":
            page.get_by_placeholder("请输入手机号").fill(str(command.payload["phone"]))
            page.get_by_text("获取验证码", exact=True).click()
            page.wait_for_timeout(2000)
            self._capture(page, "code_sent", "验证码请求已提交，请查看短信；如出现安全验证，请在下方画面完成。")
            return

        if command.action == "verify":
            self._update("verifying", "正在验证短信验证码...", active=True)
            page.get_by_placeholder("请输入验证码").fill(str(command.payload["code"]))
            page.get_by_role("button", name="登录").click()
            deadline = time.monotonic() + 30
            while time.monotonic() < deadline and not self._stop_event.is_set():
                page.wait_for_timeout(1000)
                if is_logged_in(page):
                    self._save_login(page)
                    return
                if page.url != GOOFISH_LOGIN_URL and "passport.goofish.com" not in page.url:
                    page.goto(GOOFISH_SEARCH_URL, wait_until="domcontentloaded", timeout=60000)
                    page.wait_for_timeout(2500)
                    if is_logged_in(page):
                        self._save_login(page)
                        return
            self._capture(page, "code_sent", "尚未登录成功。请检查验证码，或完成下方安全验证后重试。")
            return

        if command.action == "click":
            page.mouse.click(float(command.payload["x"]), float(command.payload["y"]))
            page.wait_for_timeout(750)
            self._capture(page)
            return

        if command.action == "drag":
            page.mouse.move(float(command.payload["start_x"]), float(command.payload["start_y"]))
            page.mouse.down()
            page.mouse.move(float(command.payload["end_x"]), float(command.payload["end_y"]), steps=20)
            page.mouse.up()
            page.wait_for_timeout(1000)
            self._capture(page)

    def _save_login(self, page) -> None:
        cookie_jar = read_page_cookie_jar(page)
        if not has_mtop_login_cookies(cookie_jar):
            page.goto(GOOFISH_SEARCH_URL, wait_until="domcontentloaded", timeout=60000)
            page.wait_for_timeout(3000)
            cookie_jar = read_page_cookie_jar(page)
        if cookie_jar:
            write_cookie_file(cookie_jar)
        self._login_saved = True

    def _capture(self, page, status: str | None = None, message: str | None = None, active: bool = True) -> None:
        if not active:
            self.screenshot_path.unlink(missing_ok=True)
            with self._lock:
                if status is not None:
                    self._status.status = status
                if message is not None:
                    self._status.message = message
                self._status.active = False
                self._status.screenshot_available = False
            return
        try:
            temporary_path = self.screenshot_path.with_suffix(".tmp.png")
            page.screenshot(path=str(temporary_path), full_page=False)
            temporary_path.replace(self.screenshot_path)
            screenshot_available = True
        except PlaywrightError:
            screenshot_available = False
        with self._lock:
            if status is not None:
                self._status.status = status
            if message is not None:
                self._status.message = message
            self._status.active = active
            self._status.screenshot_available = screenshot_available
            if screenshot_available:
                self._status.screenshot_version += 1

    def _update(self, status: str, message: str, active: bool) -> None:
        if not active:
            self.screenshot_path.unlink(missing_ok=True)
        with self._lock:
            self._status.status = status
            self._status.message = message
            self._status.active = active
            if not active:
                self._status.screenshot_available = False

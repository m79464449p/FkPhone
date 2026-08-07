import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch

from app.config import settings
from app.routers import goofish
from app.services.goofish_login_session import GoofishLoginSession


class FakeLoginContext:
    def __init__(self):
        self.logged_in = False

    def cookies(self, urls):
        return [{"name": "unb", "value": "user"}] if self.logged_in else []

    def close(self):
        return None


class FakeLoginPage:
    def __init__(self, context):
        self.context = context
        self.url = "about:blank"

    def goto(self, url, **kwargs):
        self.url = url

    def wait_for_timeout(self, milliseconds):
        if self.url.startswith("https://passport.goofish.com"):
            self.context.logged_in = True
            self.url = "https://www.goofish.com/search?q=turbo5max"


class FakePlaywright:
    def __enter__(self):
        return object()

    def __exit__(self, exc_type, exc_value, traceback):
        return False


class GoofishSessionResetTest(unittest.TestCase):
    def test_reset_goofish_session_removes_configured_cookie_and_profile_paths(self):
        original_cookie_file = settings.goofish_cookie_file
        original_profile_dir = settings.goofish_profile_dir

        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            cookie_file = temp_path / "cookies.json"
            profile_dir = temp_path / "profile"
            cookie_file.write_text('{"unb":"1","_m_h5_tk":"expired"}', encoding="utf-8")
            profile_dir.mkdir()
            (profile_dir / "state").write_text("cached", encoding="utf-8")

            settings.goofish_cookie_file = str(cookie_file)
            settings.goofish_profile_dir = str(profile_dir)
            try:
                response = goofish.reset_goofish_session()
            finally:
                settings.goofish_cookie_file = original_cookie_file
                settings.goofish_profile_dir = original_profile_dir

            self.assertEqual(response.status, "ok")
            self.assertTrue(response.cookie_file_removed)
            self.assertTrue(response.profile_removed)
            self.assertFalse(response.search_cancelled)
            self.assertFalse(cookie_file.exists())
            self.assertFalse(profile_dir.exists())

    def test_format_process_error_detail_prefers_payload_message(self):
        detail = goofish.format_process_error_detail(
            {"status": "error", "message": "闲鱼需要重新登录", "matched": 0},
            "debug output",
        )

        self.assertEqual(detail, "闲鱼需要重新登录")

    def test_format_process_error_detail_falls_back_to_output_tail(self):
        output = "x" * 2100

        detail = goofish.format_process_error_detail(None, output)

        self.assertEqual(detail, "x" * 2000)

    def test_login_session_rejects_invalid_phone_before_start(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            session = GoofishLoginSession(root / "profile", root / "login.png", headless=True)

            with self.assertRaisesRegex(ValueError, "11 位"):
                session.send_sms("123")

    def test_login_session_rejects_invalid_code_before_start(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            session = GoofishLoginSession(root / "profile", root / "login.png", headless=True)

            with self.assertRaisesRegex(ValueError, "短信验证码"):
                session.verify("12ab")

    def test_login_session_initial_status_is_idle(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            session = GoofishLoginSession(root / "profile", root / "login.png", headless=True)

            self.assertEqual(
                session.status(),
                {
                    "status": "idle",
                    "active": False,
                    "message": "尚未启动闲鱼登录。",
                    "screenshot_available": False,
                    "screenshot_version": 0,
                },
            )

    def test_login_session_stop_removes_stale_screenshot(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            screenshot = root / "login.png"
            screenshot.write_bytes(b"stale")
            session = GoofishLoginSession(root / "profile", screenshot, headless=True)

            self.assertFalse(session.stop())
            self.assertFalse(screenshot.exists())
            self.assertFalse(session.status()["screenshot_available"])

    def test_qr_login_detects_success_without_pointer_commands(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            context = FakeLoginContext()
            page = FakeLoginPage(context)
            session = GoofishLoginSession(root / "profile", root / "login.png", headless=True)

            def mark_saved(_page):
                session._update("success", "闲鱼登录成功，可以开始搜索。", active=False)

            with patch("app.services.goofish_login_session.sync_playwright", return_value=FakePlaywright()), patch(
                "app.services.goofish_login_session.launch_context", return_value=context
            ), patch("app.services.goofish_login_session.get_live_page", return_value=page), patch(
                "app.services.goofish_login_session.clear_goofish_cookies"
            ), patch("app.services.goofish_login_session.GoofishLoginSession._capture"), patch.object(
                session, "_save_login", side_effect=mark_saved
            ):
                session.start(timeout_seconds=5)
                deadline = time.monotonic() + 2
                while session.status()["active"] and time.monotonic() < deadline:
                    time.sleep(0.01)

            self.assertEqual(session.status()["status"], "success")
            self.assertFalse(session.status()["active"])


if __name__ == "__main__":
    unittest.main()

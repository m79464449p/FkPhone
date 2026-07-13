from __future__ import annotations

import json
import secrets
import ssl
import uuid
from base64 import b64decode, b64encode
from Crypto.Cipher import AES
from Crypto.Cipher import PKCS1_v1_5
from Crypto.PublicKey import RSA
from Crypto.Signature import pkcs1_15
from Crypto.Hash import MD5
from Crypto.Util.Padding import pad
from Crypto.Util.Padding import unpad
from dataclasses import dataclass
from time import time
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import Request, urlopen


BASE_URLS = [
    "https://8.138.117.186:8443/",
    "https://118.31.48.232:8443/",
    "https://[201:19f0:6001:5501:5400:05ff:fe6c:10f5]:8443/",
]

DEFAULT_TIMEOUT_SECONDS = 18
AES_KEY_A = "fdajdgnv63ldfk89"
AES_IV_A = "vczvf3126jvzc976"
AES_KEY_B = "caapchne63leac9c"
AES_IV_B = "bndbv58201jfanv6"
APP_SECRET = "tuaogndaklnckwn32532nvssakj233980"
BATTERY_PUBLIC_KEY = (
    "MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCjmbjWPQxXry9dkhMN1Pxfy"
    "OMzcE4wLRvPYqVMmQC/RBhlhPSxgCXv/jSayxh0WafMmKYiIqr7iIyyayqziuhOSrS"
    "j25cG3MKmTzyYe9EL7rlqQKNKS5uH5eTYDAkmY7uStdEZjfExjd8BTS8Z+GR4TQ6ML4aZU8gaWhJBvZVOPQIDAQAB"
)
APP_SIGNING_PRIVATE_KEY = (
    "MIICdQIBADANBgkqhkiG9w0BAQEFAASCAl8wggJbAgEAAoGBAKFXQSkwWaQtkk1K"
    "DjZegv1SzHrlP8wjcvaqmsBVS3uEUie/Za69/KNhFH40vKZk4e8OltS16Tj+to58"
    "uKnwr5jwvTWOeTaxRZHDbwAX1o5c0fgZ7ZgUwHuqD/U9+aAv97UBi27gM7ry+ai"
    "i+M8q4otXxV6BSwYePICyhmbMRP+ZAgMBAAECgYAkConT2akss8Fq4pAqNRKt5EE"
    "pcuy9fW3BDHtlW6hw/y4bEvZ0ApzdImKhjsZVpVOTQ38OJVTkFoJRcisOS2XuOLM"
    "eb1S0SR3VT0oJOvyW3moLYgjAh/TcYBcz7I2OOLpdJG7pKgelswVtLqAwUOrjCGm"
    "x9yxkovPj5sjU6NyqwQJBAOj7u8YIeEGLe05Er8lKudI41ArqNvFvTnKpqCwuOe/"
    "mhlsOdigB44t1S1lop/iRoB4vdJLu2QgAtA6oKzp1sIsCQQCxR6Vi0ynpHXAJvZw"
    "KLYLuvnXSybMZ/XI8X4Qe6xsosfQycqlikUBqZmyavuUmFu9dLNB0rxCPgnbXIA5"
    "+wdDrAkA81w/v5OJSa3QlujYVYJgp14E34HW8ko5vzvIFp4SlqxNGz/328JdVIao"
    "tjPDgLlcbytSsUgcG2fgrI6s2NumFAkBEooVwbmqyexguXT91XUts3UZGlpqFvG8"
    "m2qAPTFzWc5cklOnpZGz5BLCVdMTI62Y+v6PxGPojZZJXFW0nPCiDAkByivVSVrW"
    "pjRVQVk7oexC6ky2Tx1XYxY0xswNT24SO+fHvgIoBy0I8lsIBACUmhwdqnUc4QGX"
    "OYFCpkE83iZEr"
)
APK_RESPONSE_ERROR_KEY = "fdka32hjewg02t3kj029hg"
APK_BODY_AES_IV = "vczvf3126jvzc976"
APK_DEFAULT_INTERCEPTOR_B = "kjcvxyuRyGibKX9KylmGXPsB6HRSgI4Y0jE/P8xNKAcbtZhAwj4IomVvH0gp9Q02"
APK_DEFAULT_INTERCEPTOR_C = "KhBJ3k7xHB20phvV8OcUlA=="
APK_DEFAULT_BATTERY_VALUE = "dadgagahah"
APK_DEFAULT_BOARD_VALUE = "abc"
APK_DEFAULT_DYNAMIC_DEX_VALUE = "abcde"


@dataclass(frozen=True)
class SocmarkEndpoint:
    key: str
    method: str
    path: str
    description: str
    sample_payload: dict[str, Any] | None = None


RANKING_PAYLOAD = {
    "pageNum": 1,
    "pageSize": 20,
    "type": 0,
    "orderColumn": "score",
    "order": 1,
}

ENDPOINTS: dict[str, SocmarkEndpoint] = {
    "about": SocmarkEndpoint("about", "GET", "about", "关于信息"),
    "privacy": SocmarkEndpoint("privacy", "GET", "privacy", "隐私协议"),
    "phonebrand": SocmarkEndpoint("phonebrand", "GET", "phonebrand", "手机品牌列表"),
    "scoreenc": SocmarkEndpoint("scoreenc", "POST", "scoreenc", "手机性能排行", RANKING_PAYLOAD),
    "cpulist": SocmarkEndpoint("cpulist", "POST", "cpulist", "CPU 排行", RANKING_PAYLOAD),
    "listgpu": SocmarkEndpoint("listgpu", "POST", "listgpu", "GPU 列表", RANKING_PAYLOAD),
    "comparegpulist": SocmarkEndpoint("comparegpulist", "POST", "comparegpulist", "GPU 对比列表", RANKING_PAYLOAD),
    "comparecpulist": SocmarkEndpoint("comparecpulist", "POST", "comparecpulist", "CPU 对比列表", RANKING_PAYLOAD),
    "dxolist": SocmarkEndpoint("dxolist", "POST", "dxolist", "DXO 列表", RANKING_PAYLOAD),
    "cameralist": SocmarkEndpoint("cameralist", "POST", "cameralist", "相机列表", RANKING_PAYLOAD),
    "powerlist": SocmarkEndpoint("powerlist", "POST", "powerlist", "续航列表", RANKING_PAYLOAD),
    "padlist": SocmarkEndpoint("padlist", "POST", "padlist", "平板列表", RANKING_PAYLOAD),
    "soclevel": SocmarkEndpoint("soclevel", "POST", "soclevel", "SoC 等级", RANKING_PAYLOAD),
    "socgpu": SocmarkEndpoint("socgpu", "POST", "socgpu", "SoC GPU", {"soc_name": ""}),
    "scorenetwork": SocmarkEndpoint("scorenetwork", "POST", "scorenetwork", "网络评分", {"phone_id": ""}),
    "cpukey": SocmarkEndpoint("cpukey", "POST", "cpukey", "CPU 关键字", {"key": ""}),
    "findcamera": SocmarkEndpoint("findcamera", "POST", "findcamera", "查找相机", {"key": ""}),
    "findgpu": SocmarkEndpoint("findgpu", "POST", "findgpu", "查找 GPU", {"key": ""}),
    "listgpuboard": SocmarkEndpoint("listgpuboard", "POST", "listgpuboard", "GPU 面板列表", {"key": ""}),
    "getphonemark": SocmarkEndpoint("getphonemark", "POST", "getphonemark", "机型标记", {"phone_id": ""}),
    "typephone": SocmarkEndpoint("typephone", "POST", "typephone", "按类型查机型", {"type": 0, "pageNum": 1, "pageSize": 20}),
    "addphone": SocmarkEndpoint("addphone", "POST", "addphone", "添加手机", {}),
    "publishlist": SocmarkEndpoint("publishlist", "POST", "publishlist", "发布列表", {"pageNum": 1, "pageSize": 20}),
    "newenc": SocmarkEndpoint("newenc", "POST", "newenc", "新品列表", {"startTime": "", "endTime": "", "order": "desc"}),
    "search2enc": SocmarkEndpoint(
        "search2enc",
        "POST",
        "search2enc",
        "高级搜索",
        {
            "key": "",
            "pageNum": 1,
            "pageSize": 20,
            "type": 0,
            "orderColumn": "score",
            "order": "desc",
            "lowPrice": "",
            "highPrice": "",
            "soc_name": "",
            "screenn": "",
            "screenm": "",
            "minsize": "",
            "maxsize": "",
            "battery": "",
            "brandlist": [],
            "5G": "",
            "nfc": "",
            "ufs": "",
        },
    ),
    "updateconfig": SocmarkEndpoint(
        "updateconfig",
        "POST",
        "updateconfig",
        "配置更新",
        {
            "version": "",
            "channel": "default",
            "versionCode": "",
            "versionName": "",
            "libsize": "",
            "libtype": "",
            "somd5": "",
        },
    ),
    "bindconfigupdate": SocmarkEndpoint("bindconfigupdate", "POST", "bindconfigupdate", "绑定配置更新", {}),
    "dataintro": SocmarkEndpoint("dataintro", "POST", "dataintro", "数据说明", {}),
    "browsergoods": SocmarkEndpoint("browsergoods", "POST", "browsergoods", "商品浏览", {}),
    "scopeenc": SocmarkEndpoint("scopeenc", "POST", "scopeenc", "范围数据", {}),
    "collectboards": SocmarkEndpoint("collectboards", "POST", "collectboards", "收藏榜单", {}),
    "collectdigital": SocmarkEndpoint("collectdigital", "POST", "collectdigital", "收藏数码", {}),
    "collectenc": SocmarkEndpoint("collectenc", "POST", "collectenc", "收藏", {}),
    "digitalstore": SocmarkEndpoint("digitalstore", "POST", "digitalstore", "数码商店", {}),
    "activitycode": SocmarkEndpoint("activitycode", "POST", "activitycode", "活动码", {"code": ""}),
    "unactivitycode": SocmarkEndpoint("unactivitycode", "POST", "unactivitycode", "解绑活动码", {"code": ""}),
}

HEADER_NOTES = {
    "appstore": "APK 固定写入 default。",
    "dfagjakhaklhakljkj209r3h00hg": "客户端把服务端响应头 datastr 存到本地后，下次请求带回；页面默认使用 abcde，可覆盖。",
    "fdaga93gogh20hagah0ghaklha": "APK 中来自本地 uniid；后端默认生成 UUID，可覆盖。",
    "adfdjew9v0svjna": "已复现：AES/CBC/PKCS5Padding 加密 adafi1278819hfFMVdsvsla + 当前毫秒。",
    "rjvi320f34r3ngkdlasg02t": "已复现：AES/CBC/PKCS5Padding 加密固定串 djf023nv9023jr1q0fjaj02jlaghwh0。",
    "edsafagv325421fa327das": "APK 中由 BatteryUtil.getBattery + RSA 生成；当前默认使用已 emu 得到的 dadgagahah。",
    "vjdsu329yfh32ihf803290fh": "来自拦截器构造参数 b，APK 里通常是 jj.h(应用签名相关值)；可在高级参数里提供。",
    "eiwovndsh3rioy89fhi3r89g2e": "来自拦截器构造参数 c，APK 里通常是 jj.h(设备信息组合值)；可在高级参数里提供。",
    "fjkcvj9w0932tkahg0a": "APK 尝试加载动态 dex 的 com.test.mylibrary.TestUtil.test()；失败时回退 abcde。",
    "kj9023hfahg290ahglagh": "APK 调用 native BoardUtil.getBoard(1)，可通过额外 headers 覆盖。",
    "fwv932jhf302hkashf2030hf0": "来自拦截器构造参数，与 eiwov... 同源；可通过额外 headers 覆盖。",
    "appEncryptedKey": "APK 的 Lfe 拦截器生成：随机 AES key 经 BatteryUtil 公钥 RSA 加密。",
    "appSignature": "APK 的 Lfe 拦截器生成：请求明文体经 MD5withRSA 签名。",
    "appPublicKey": "APK 的 Lfe 拦截器生成：本次请求临时 RSA 公钥，用于服务端回包加密。",
}


class SocmarkAPIError(RuntimeError):
    pass


def list_endpoint_catalog() -> list[dict[str, Any]]:
    return [
        {
            "key": endpoint.key,
            "method": endpoint.method,
            "path": endpoint.path,
            "description": endpoint.description,
            "sample_payload": endpoint.sample_payload,
        }
        for endpoint in ENDPOINTS.values()
    ]


def _normalize_base_url(base_url: str | None) -> str:
    if base_url is None:
        return BASE_URLS[0]
    if base_url not in BASE_URLS:
        raise SocmarkAPIError("base_url 不在 APK 反编译得到的白名单内")
    return base_url


def _aes_cbc_base64(value: str, key: str, iv: str) -> str:
    cipher = AES.new(key.encode("utf-8"), AES.MODE_CBC, iv.encode("utf-8"))
    encrypted = cipher.encrypt(pad(value.encode("utf-8"), AES.block_size))
    return b64encode(encrypted).decode("ascii")


def _rsa_encrypt_base64(value: str, public_key: str = BATTERY_PUBLIC_KEY) -> str:
    key = RSA.import_key(b64decode(public_key))
    cipher = PKCS1_v1_5.new(key)
    chunk_size = key.size_in_bytes() - 11
    value_bytes = value.encode("utf-8")
    encrypted_chunks = [
        cipher.encrypt(value_bytes[index : index + chunk_size])
        for index in range(0, len(value_bytes), chunk_size)
    ]
    return b64encode(b"".join(encrypted_chunks)).decode("ascii")


def _rsa_decrypt_base64(value: str, private_key: RSA.RsaKey) -> str | None:
    try:
        decrypted = PKCS1_v1_5.new(private_key).decrypt(b64decode(value), b"")
    except (ValueError, TypeError):
        return None
    if not decrypted:
        return None
    return decrypted.decode("utf-8", errors="replace")


def _sign_md5_rsa_base64(value: bytes) -> str:
    key = RSA.import_key(b64decode(APP_SIGNING_PRIVATE_KEY))
    signature = pkcs1_15.new(key).sign(MD5.new(value))
    return b64encode(signature).decode("ascii")


def _aes_body_encrypt_base64(value: str, aes_key: str) -> str:
    cipher = AES.new(aes_key.encode("utf-8"), AES.MODE_CBC, APK_BODY_AES_IV.encode("utf-8"))
    return b64encode(cipher.encrypt(pad(value.encode("utf-8"), AES.block_size))).decode("ascii")


def _aes_body_decrypt_base64(value: str, aes_key: str) -> str | None:
    if len(aes_key) not in {16, 24, 32}:
        return None
    try:
        cipher = AES.new(aes_key.encode("utf-8"), AES.MODE_CBC, APK_BODY_AES_IV.encode("utf-8"))
        return unpad(cipher.decrypt(b64decode(value)), AES.block_size).decode("utf-8")
    except (ValueError, TypeError):
        return None


def _build_apk_transport(
    method: str,
    headers: dict[str, str],
    body_text: str,
) -> tuple[dict[str, str], bytes | None, RSA.RsaKey]:
    response_key_pair = RSA.generate(1024)
    request_aes_key = secrets.token_bytes(16).hex()
    headers = dict(headers)
    headers["appEncryptedKey"] = _rsa_encrypt_base64(request_aes_key)
    headers["appSignature"] = _sign_md5_rsa_base64(body_text.encode("utf-8"))
    headers["appPublicKey"] = b64encode(response_key_pair.publickey().export_key("DER")).decode("ascii")

    if method == "POST":
        encrypted_body = _aes_body_encrypt_base64(body_text, request_aes_key)
        headers["Content-Type"] = "text/plain; charset=utf-8"
        headers["Content-Length"] = str(len(encrypted_body.encode("utf-8")))
        return headers, encrypted_body.encode("utf-8"), response_key_pair
    return headers, None, response_key_pair


def _compact_optional_headers(values: dict[str, str | None]) -> dict[str, str]:
    return {key: value for key, value in values.items() if value is not None and value != ""}


def build_reversed_headers(
    datastr: str | None = None,
    uniid: str | None = None,
    extra_headers: dict[str, str] | None = None,
    now_ms: int | None = None,
    interceptor_a: str | None = None,
    interceptor_b: str | None = None,
    interceptor_c: str | None = None,
    battery_value: str | None = None,
    board_value: str | None = None,
    dynamic_dex_value: str | None = None,
    time_offset_ms: int = 0,
) -> dict[str, str]:
    timestamp = now_ms or int(time() * 1000)
    native_timestamp = timestamp + time_offset_ms
    headers = {
        "Accept": "application/json, text/plain, */*",
        "Content-Type": "application/json; charset=utf-8",
        "User-Agent": "okhttp/3.12.0",
        "appstore": "default",
        "dfagjakhaklhakljkj209r3h00hg": datastr or "abcde",
        "fdaga93gogh20hagah0ghaklha": uniid or str(uuid.uuid4()),
        "adfdjew9v0svjna": _aes_cbc_base64(f"adafi1278819hfFMVdsvsla{timestamp}", AES_KEY_A, AES_IV_A),
        "rjvi320f34r3ngkdlasg02t": _aes_cbc_base64("djf023nv9023jr1q0fjaj02jlaghwh0", AES_KEY_B, AES_IV_B),
        "fjkcvj9w0932tkahg0a": dynamic_dex_value or "abcde",
    }
    headers.update(
        _compact_optional_headers(
            {
                "vjdsu329yfh32ihf803290fh": interceptor_b,
                "eiwovndsh3rioy89fhi3r89g2e": interceptor_c,
                "kj9023hfahg290ahglagh": board_value,
                "fwv932jhf302hkashf2030hf0": interceptor_c,
            }
        )
    )
    if interceptor_a is not None and battery_value:
        battery_time_token = _aes_cbc_base64(f"i129hf{native_timestamp}", AES_KEY_B, AES_IV_B)
        signature_source = f"{interceptor_a}vig89h2f3223gsgsh{battery_time_token}vig89h2f3223gsgsh{battery_value}"
        headers["edsafagv325421fa327das"] = _rsa_encrypt_base64(signature_source)
    for key, value in (extra_headers or {}).items():
        clean_key = key.strip()
        if not clean_key:
            continue
        headers[clean_key] = str(value)
    return headers


def build_header_status(headers: dict[str, str]) -> list[dict[str, str]]:
    generated = {
        "appstore",
        "dfagjakhaklhakljkj209r3h00hg",
        "fdaga93gogh20hagah0ghaklha",
        "adfdjew9v0svjna",
        "rjvi320f34r3ngkdlasg02t",
        "fjkcvj9w0932tkahg0a",
        "appEncryptedKey",
        "appSignature",
        "appPublicKey",
    }
    optional = {
        "edsafagv325421fa327das": "需要 interceptor_a + native battery_value 才能生成",
        "vjdsu329yfh32ihf803290fh": "需要 interceptor_b",
        "eiwovndsh3rioy89fhi3r89g2e": "需要 interceptor_c",
        "kj9023hfahg290ahglagh": "需要 native board_value",
        "fwv932jhf302hkashf2030hf0": "需要 interceptor_c",
    }
    rows = [
        {"key": key, "state": "generated", "note": HEADER_NOTES.get(key, "")}
        for key in generated
        if key in headers
    ]
    rows.extend(
        {
            "key": key,
            "state": "generated" if key in headers else "missing",
            "note": HEADER_NOTES.get(key, missing_note),
        }
        for key, missing_note in optional.items()
    )
    return rows


def _build_headers(
    datastr: str | None,
    uniid: str | None,
    extra_headers: dict[str, str] | None,
    apk_options: dict[str, Any] | None,
) -> dict[str, str]:
    options = apk_options or {}
    return build_reversed_headers(
        datastr=datastr,
        uniid=uniid,
        extra_headers=extra_headers,
        interceptor_a=options.get("interceptor_a") or "null",
        interceptor_b=options.get("interceptor_b") or APK_DEFAULT_INTERCEPTOR_B,
        interceptor_c=options.get("interceptor_c") or APK_DEFAULT_INTERCEPTOR_C,
        battery_value=options.get("battery_value") or APK_DEFAULT_BATTERY_VALUE,
        board_value=options.get("board_value") or APK_DEFAULT_BOARD_VALUE,
        dynamic_dex_value=options.get("dynamic_dex_value") or APK_DEFAULT_DYNAMIC_DEX_VALUE,
        time_offset_ms=int(options.get("time_offset_ms") or 0),
    )


def call_socmark_endpoint(
    endpoint_key: str,
    payload: dict[str, Any] | None,
    base_url: str | None = None,
    datastr: str | None = None,
    uniid: str | None = None,
    extra_headers: dict[str, str] | None = None,
    apk_options: dict[str, Any] | None = None,
    timeout_seconds: int = DEFAULT_TIMEOUT_SECONDS,
) -> dict[str, Any]:
    endpoint = ENDPOINTS.get(endpoint_key)
    if endpoint is None:
        raise SocmarkAPIError("endpoint 不在白名单内")

    normalized_base_url = _normalize_base_url(base_url)
    url = urljoin(normalized_base_url, endpoint.path)
    headers = _build_headers(datastr, uniid, extra_headers, apk_options)
    body_text = ""
    if endpoint.method == "POST":
        body_text = json.dumps(payload or {}, ensure_ascii=False, separators=(",", ":"))
    headers, body_bytes, response_private_key = _build_apk_transport(endpoint.method, headers, body_text)

    request = Request(url, data=body_bytes, headers=headers, method=endpoint.method)
    context = ssl._create_unverified_context()

    try:
        with urlopen(request, timeout=timeout_seconds, context=context) as response:
            status_code = response.status
            response_headers = dict(response.headers.items())
            raw_body = response.read()
    except HTTPError as err:
        status_code = err.code
        response_headers = dict(err.headers.items())
        raw_body = err.read()
    except URLError as err:
        raise SocmarkAPIError(str(err.reason)) from err
    except TimeoutError as err:
        raise SocmarkAPIError("上游请求超时") from err

    body_text = raw_body.decode("utf-8", errors="replace")
    decrypted_body_text = None
    server_response_key = _rsa_decrypt_base64(response_headers.get("serverEncryptedKey", ""), response_private_key)
    if server_response_key and server_response_key != APK_RESPONSE_ERROR_KEY:
        decrypted_body_text = _aes_body_decrypt_base64(body_text, server_response_key)
    try:
        parsed_body: Any = json.loads(decrypted_body_text or body_text)
    except json.JSONDecodeError:
        parsed_body = None

    return {
        "endpoint": endpoint.key,
        "method": endpoint.method,
        "path": endpoint.path,
        "base_url": normalized_base_url,
        "url": url,
        "request_payload": payload or {},
        "request_headers": headers,
        "header_status": build_header_status(headers),
        "status_code": status_code,
        "response_headers": response_headers,
        "server_response_key": server_response_key,
        "body": parsed_body,
        "body_text": body_text,
        "decrypted_body_text": decrypted_body_text,
    }

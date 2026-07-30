import tempfile
import unittest
from pathlib import Path

from app.config import settings
from app.routers import goofish


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


if __name__ == "__main__":
    unittest.main()

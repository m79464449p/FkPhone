import unittest

from app.routers.phones import build_compare_rows, normalize_config_ids


class PhoneCompareTest(unittest.TestCase):
    def test_normalize_config_ids_accepts_repeated_and_comma_separated_values(self):
        self.assertEqual(
            normalize_config_ids(["8959, 8960", "8959", "", "8961"]),
            ["8959", "8960", "8961"],
        )

    def test_build_compare_rows_merges_specs_by_normalized_name(self):
        rows = build_compare_rows(
            [
                {
                    "config_id": "8959",
                    "specs": [
                        {
                            "group": "重要参数",
                            "subgroup": "性能",
                            "name": "芯片",
                            "value": "骁龙 8",
                        }
                    ],
                },
                {
                    "config_id": "8960",
                    "specs": [
                        {
                            "group": "核心参数",
                            "subgroup": "处理器",
                            "name": " 芯片 ",
                            "value": "骁龙 8 Elite",
                        }
                    ],
                },
            ],
            ["8959", "8960"],
        )

        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0].name, "芯片")
        self.assertEqual(
            rows[0].values,
            {"8959": "骁龙 8", "8960": "骁龙 8 Elite"},
        )


if __name__ == "__main__":
    unittest.main()

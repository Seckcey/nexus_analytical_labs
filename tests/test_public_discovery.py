from __future__ import annotations

import unittest
from pathlib import Path


APP_SOURCE = Path(__file__).resolve().parents[1] / "app.py"


class PublicDiscoveryTests(unittest.TestCase):
    def test_sitemap_contract_lists_only_the_public_homepage(self) -> None:
        source = APP_SOURCE.read_text(encoding="utf-8")

        self.assertIn('@app.get("/sitemap.xml")', source)
        self.assertIn("https://nexusanalyticallabs.com/", source)
        self.assertIn('mimetype="application/xml"', source)
        self.assertEqual(source.count("<url>"), 1)


if __name__ == "__main__":
    unittest.main()

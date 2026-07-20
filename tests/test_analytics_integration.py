from __future__ import annotations

import unittest

from flask import Flask

from analytics_integration import SCRIPT_TAG, install_analytics


class AnalyticsIntegrationTests(unittest.TestCase):
    def setUp(self) -> None:
        app = Flask(__name__)
        install_analytics(app)

        @app.get("/html")
        def html_page():
            return "<!doctype html><html><body>hello</body></html>"

        @app.get("/json")
        def json_page():
            return {"ok": True}

        self.client = app.test_client()

    def test_injects_once_into_html(self) -> None:
        response = self.client.get("/html")
        body = response.get_data(as_text=True)
        self.assertEqual(body.count(SCRIPT_TAG), 1)
        self.assertIn(f"{SCRIPT_TAG}\n</body>", body)

    def test_does_not_touch_json(self) -> None:
        response = self.client.get("/json")
        self.assertEqual(response.mimetype, "application/json")
        self.assertNotIn(SCRIPT_TAG, response.get_data(as_text=True))


if __name__ == "__main__":
    unittest.main()

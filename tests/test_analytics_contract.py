from __future__ import annotations

import unittest
from pathlib import Path


JS_PATH = Path(__file__).resolve().parents[1] / "static" / "js" / "analytics.js"


class AnalyticsContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.javascript = JS_PATH.read_text(encoding="utf-8")

    def test_manual_tracker_configuration(self) -> None:
        self.assertIn("28a7129d-766b-4c54-a979-9a234e6be68d", self.javascript)
        self.assertIn('script.setAttribute("data-auto-track", "false")', self.javascript)
        self.assertIn('script.setAttribute("data-before-send", "nexusAnalyticsBeforeSend")', self.javascript)

    def test_uses_only_sanitized_paths(self) -> None:
        self.assertIn('url: "/payment"', self.javascript)
        self.assertIn('url: "/"', self.javascript)
        self.assertNotIn("window.location.href", self.javascript)
        self.assertNotIn("window.location.search", self.javascript)
        self.assertNotIn("window.location.hash", self.javascript)
        self.assertNotIn("document.referrer", self.javascript)

    def test_does_not_read_form_values(self) -> None:
        forbidden = (
            ".value",
            "FormData",
            "client_name",
            "compound_name",
            "lot_batch",
            "request_number",
            "selected_tests",
            "bitcoin_wallet",
        )
        for token in forbidden:
            self.assertNotIn(token, self.javascript)

    def test_allows_only_approved_events(self) -> None:
        for event_name in (
            "testing_request_started",
            "testing_request_submit_attempted",
            "payment_proof_email_clicked",
        ):
            self.assertIn(event_name, self.javascript)
        self.assertNotIn("umami.identify", self.javascript)
        self.assertIn("if (payload.data || payload.referrer) return false;", self.javascript)


if __name__ == "__main__":
    unittest.main()

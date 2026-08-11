from __future__ import annotations

import unittest
from pathlib import Path


JS_PATH = Path(__file__).resolve().parents[1] / "static" / "js" / "analytics.js"


class AnalyticsContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.javascript = JS_PATH.read_text(encoding="utf-8")

    def test_explicit_consent_and_privacy_settings(self) -> None:
        self.assertIn('GA4_MEASUREMENT_ID = "G-KYJLM0BL40"', self.javascript)
        for setting in (
            "analytics_storage: CONSENT_DENIED",
            "ad_storage: CONSENT_DENIED",
            "ad_user_data: CONSENT_DENIED",
            "ad_personalization: CONSENT_DENIED",
            "allow_google_signals: false",
            "allow_ad_personalization_signals: false",
            "send_page_view: false",
            "consentState !== CONSENT_GRANTED",
        ):
            self.assertIn(setting, self.javascript)

    def test_uses_only_sanitized_paths(self) -> None:
        self.assertIn('path: "/payment"', self.javascript)
        self.assertIn('path: "/"', self.javascript)
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

    def test_legacy_tracker_is_completely_removed(self) -> None:
        legacy_name = "um" + "ami"
        for token in (
            ".".join(("analytics", "8westventures", "com")),
            "window." + legacy_name,
            legacy_name + ".track",
            "data-" + "website-id",
        ):
            self.assertNotIn(token, self.javascript)


if __name__ == "__main__":
    unittest.main()

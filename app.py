from __future__ import annotations

import io
import json
import os
import secrets
import string
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

import qrcode
import qrcode.image.svg
from flask import Flask, Response, abort, redirect, render_template, request, url_for


BASE_DIR = Path(__file__).resolve().parent
DATA_FILE = Path(os.getenv("NEXUS_REQUEST_LOG", BASE_DIR / "data" / "test_requests.jsonl"))
SALES_EMAIL = os.getenv("NEXUS_SALES_EMAIL", "sales@nexusanalyticallabs.com")
BITCOIN_WALLET_ADDRESS = os.getenv("NEXUS_BTC_WALLET", "REPLACE_WITH_NEXUS_BTC_WALLET")
BITCOIN_WALLET_IS_CONFIGURED = not BITCOIN_WALLET_ADDRESS.startswith("REPLACE_WITH")
BTCPAY_POS_URL = os.getenv(
    "NEXUS_BTCPAY_POS_URL",
    "https://btcpay.8westventures.com/apps/36H9XAKeKdJyAwUGaUis2wKRXu3U/pos",
)

BASE_TEST = {
    "key": "base",
    "name": "Base HPLC-UV Peptide Analysis",
    "short_name": "Base HPLC-UV Analysis",
    "description": "Chromatographic purity with identity confirmation.",
    "price": 25,
}

ADD_ON_TESTS = [
    {
        "key": "endotoxin",
        "name": "Endotoxin Test",
        "description": "LAL / rFC screen with reported result.",
        "price": 50,
    },
    {
        "key": "heavy_metals",
        "name": "Heavy Metals Test",
        "description": "ICP-MS screen for priority metals.",
        "price": 75,
    },
    {
        "key": "residual_solvents",
        "name": "Residual Solvents Test",
        "description": "GC-MS residual solvent screen.",
        "price": 30,
    },
]

REQUIRED_FIELDS = {
    "client_name": "Client name",
    "email": "Email address",
    "compound_name": "Compound / sample name",
    "lot_batch": "Lot / batch number",
    "quantity": "Quantity / presentation",
}


def create_app() -> Flask:
    app = Flask(__name__)

    @app.get("/")
    def index() -> str:
        return render_template(
            "index.html",
            add_on_tests=ADD_ON_TESTS,
            base_test=BASE_TEST,
            sales_email=SALES_EMAIL,
            form_data={},
            errors={},
        )

    @app.post("/submit")
    def submit_request() -> Response | str:
        form_data = normalize_form_data(request.form)
        errors = validate_form_data(form_data)

        if errors:
            return render_template(
                "index.html",
                add_on_tests=ADD_ON_TESTS,
                base_test=BASE_TEST,
                sales_email=SALES_EMAIL,
                form_data=form_data,
                errors=errors,
            ), 400

        record = build_request_record(form_data)
        save_request_record(record)
        return redirect(url_for("payment", request_number=record["request_number"]))

    @app.get("/payment/<request_number>")
    def payment(request_number: str) -> str:
        record = find_request_record(request_number)
        if record is None:
            abort(404)

        return render_template(
            "payment.html",
            record=record,
            sales_email=SALES_EMAIL,
            bitcoin_wallet_address=BITCOIN_WALLET_ADDRESS,
            bitcoin_wallet_is_configured=BITCOIN_WALLET_IS_CONFIGURED,
            btcpay_pos_url=BTCPAY_POS_URL,
            proof_mailto=build_proof_mailto(record),
        )

    @app.get("/qr/<request_number>.svg")
    def payment_qr(request_number: str) -> Response:
        record = find_request_record(request_number)
        if record is None:
            abort(404)

        qr_payload = build_bitcoin_qr_payload(record)
        return Response(make_qr_svg(qr_payload), mimetype="image/svg+xml")

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


def normalize_form_data(form: Any) -> dict[str, Any]:
    selected_add_ons = [
        key for key in form.getlist("add_ons") if key in {test["key"] for test in ADD_ON_TESTS}
    ]

    return {
        "client_name": form.get("client_name", "").strip(),
        "company": form.get("company", "").strip(),
        "email": form.get("email", "").strip(),
        "phone": form.get("phone", "").strip(),
        "compound_name": form.get("compound_name", "").strip(),
        "lot_batch": form.get("lot_batch", "").strip(),
        "quantity": form.get("quantity", "").strip(),
        "intended_use": form.get("intended_use", "").strip(),
        "notes": form.get("notes", "").strip(),
        "add_ons": selected_add_ons,
    }


def validate_form_data(form_data: dict[str, Any]) -> dict[str, str]:
    errors: dict[str, str] = {}

    for field, label in REQUIRED_FIELDS.items():
        if not form_data.get(field):
            errors[field] = f"{label} is required."

    email = form_data.get("email", "")
    if email and ("@" not in email or "." not in email.rsplit("@", 1)[-1]):
        errors["email"] = "Enter a valid email address."

    return errors


def build_request_record(form_data: dict[str, Any]) -> dict[str, Any]:
    selected_tests = selected_test_rows(form_data["add_ons"])
    total = sum(test["price"] for test in selected_tests)

    return {
        "request_number": generate_request_number(),
        "submitted_at": datetime.now(timezone.utc).isoformat(),
        "status": "Pending Payment",
        "client_name": form_data["client_name"],
        "company": form_data["company"],
        "email": form_data["email"],
        "phone": form_data["phone"],
        "compound_name": form_data["compound_name"],
        "lot_batch": form_data["lot_batch"],
        "quantity": form_data["quantity"],
        "intended_use": form_data["intended_use"],
        "notes": form_data["notes"],
        "selected_tests": selected_tests,
        "total": total,
    }


def selected_test_rows(add_on_keys: list[str]) -> list[dict[str, Any]]:
    selected_tests = [BASE_TEST]
    selected_tests.extend(test for test in ADD_ON_TESTS if test["key"] in add_on_keys)
    return selected_tests


def generate_request_number() -> str:
    alphabet = string.ascii_uppercase + string.digits
    suffix = "".join(secrets.choice(alphabet) for _ in range(6))
    return f"NAL-{datetime.now().year}-{suffix}"


def save_request_record(record: dict[str, Any]) -> None:
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    with DATA_FILE.open("a", encoding="utf-8") as request_log:
        request_log.write(json.dumps(record, ensure_ascii=False) + "\n")


def find_request_record(request_number: str) -> dict[str, Any] | None:
    if not DATA_FILE.exists():
        return None

    with DATA_FILE.open("r", encoding="utf-8") as request_log:
        for line in request_log:
            if not line.strip():
                continue
            record = json.loads(line)
            if record.get("request_number") == request_number:
                return record

    return None


def build_bitcoin_qr_payload(record: dict[str, Any]) -> str:
    if not BITCOIN_WALLET_IS_CONFIGURED:
        return f"Nexus Analytical Labs payment for {record['request_number']}: wallet address pending"

    query = urlencode(
        {
            "label": "Nexus Analytical Labs",
            "message": f"Payment for {record['request_number']}",
        }
    )
    return f"bitcoin:{BITCOIN_WALLET_ADDRESS}?{query}"


def make_qr_svg(payload: str) -> bytes:
    image_factory = qrcode.image.svg.SvgPathImage
    qr_image = qrcode.make(payload, image_factory=image_factory, box_size=12)
    output = io.BytesIO()
    qr_image.save(output)
    return output.getvalue()


def build_proof_mailto(record: dict[str, Any]) -> str:
    selected_tests = ", ".join(test["name"] for test in record["selected_tests"])
    subject = f"Payment proof for {record['request_number']}"
    body = (
        "Nexus Analytical Labs,\r\n\r\n"
        f"I am sending proof of payment for request {record['request_number']}.\r\n"
        f"Client: {record['client_name']}\r\n"
        f"Company: {record.get('company') or 'N/A'}\r\n"
        f"Sample: {record['compound_name']}\r\n"
        f"Lot / batch: {record['lot_batch']}\r\n"
        f"Selected tests: {selected_tests}\r\n"
        f"Total due: ${record['total']}.00 USD\r\n\r\n"
        "Payment proof is attached."
    )
    return f"mailto:{SALES_EMAIL}?{urlencode({'subject': subject, 'body': body})}"


app = create_app()


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8010, debug=True)

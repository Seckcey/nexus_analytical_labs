# Nexus Analytical Labs Website

Main-domain customer testing request app for `nexusanalyticallabs.com`.

This is separate from the COA generator app. The intended production split is:

- `https://nexusanalyticallabs.com/` -> this customer request app
- `https://www.nexusanalyticallabs.com/` -> this customer request app or a redirect to the apex domain
- `https://coa.nexusanalyticallabs.com/` -> the separate COA generator app

The site provides a clean peptide testing request flow:

- Base HPLC-UV peptide analysis: `$75`
- Endotoxin add-on: `+$50`
- Heavy metals add-on: `+$75`
- Residual solvents add-on: `+$30`
- Server-side request number generation
- Local request logging to `data/test_requests.jsonl`
- Bitcoin QR/payment instruction page
- Proof-of-payment instructions for `sales@nexusanalyticallabs.com`

## Setup

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
```

Open:

```text
http://127.0.0.1:8010/
```

## Required Production Setting

Set the Bitcoin wallet before making the site public:

```bash
export NEXUS_BTC_WALLET="your_bitcoin_wallet_address_here"
```

Optional settings:

```bash
export NEXUS_SALES_EMAIL="sales@nexusanalyticallabs.com"
export NEXUS_REQUEST_LOG="/var/www/nexus_analytical_labs/data/test_requests.jsonl"
```

If `NEXUS_BTC_WALLET` is not set, the payment page shows a warning and uses a placeholder wallet value.

## Linode / Ubuntu Example

```bash
sudo apt update
sudo apt install -y python3 python3-venv python3-pip nginx git

cd /var/www
sudo git clone https://github.com/Seckcey/nexus_analytical_labs.git nexus_analytical_labs
cd /var/www/nexus_analytical_labs

python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

export NEXUS_BTC_WALLET="your_bitcoin_wallet_address_here"
gunicorn --bind 127.0.0.1:8010 wsgi:application
```

For a permanent service, create a systemd unit that runs:

```bash
/var/www/nexus_analytical_labs/.venv/bin/gunicorn --workers 2 --bind 127.0.0.1:8010 wsgi:application
```

Then point nginx for `nexusanalyticallabs.com` and `www.nexusanalyticallabs.com` to `http://127.0.0.1:8010`.

See `deploy/` for example systemd and nginx configuration snippets.

## Request Records

Each submitted request is stored as one JSON line in:

```text
data/test_requests.jsonl
```

This file is ignored by Git so customer submissions are not committed.

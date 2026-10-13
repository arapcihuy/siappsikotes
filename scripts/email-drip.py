#!/usr/bin/env python3
"""
Zero-cost email drip for 1k leads via Brevo (SendinBlue) free tier.
Daily cron: sends next email in 5-step sequence per lead.
Rate limited to 300/day. Idempotent via state.json.
"""
import os
import json
import csv
import sys
from datetime import date, datetime
from pathlib import Path

import requests

REPO_ROOT = Path(__file__).parent.parent
LEADS_CSV = REPO_ROOT / "leads" / "leads.csv"
STATE_FILE = REPO_ROOT / "leads" / "state.json"


def _int_env(name, default):
    """Baca env sebagai int; kosong atau tidak valid -> pakai default.

    GitHub Actions menyetel secret yang belum diisi menjadi string KOSONG, bukan
    membiarkannya tak ada. Jadi os.getenv(name, default) tetap mengembalikan ''
    dan int('') melempar ValueError -> workflow gagal setiap hari.
    """
    raw = (os.getenv(name) or "").strip()
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


TEMPLATE_MAP = {n: _int_env(f"BREVO_TPL_{n}", n) for n in range(1, 6)}
DAILY_CAP = _int_env("DAILY_CAP", 300)
API_URL = "https://api.brevo.com/v3/smtp/email"
API_KEY = os.getenv("BREVO_API_KEY")
SENDER_EMAIL = os.getenv("BREVO_SENDER", "noreply@siappsikotes.my.id")
SENDER_NAME = "SiapPsikotes"


def load_leads():
    """Load leads from CSV. Expected columns: email,nama,source,signup_date"""
    leads = []
    if not LEADS_CSV.exists():
        print(f"[warn] {LEADS_CSV} not found")
        return leads
    with open(LEADS_CSV, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            email = row.get("email", "").strip().lower()
            if email and "@" in email:
                leads.append({
                    "email": email,
                    "nama": row.get("nama", "").strip(),
                    "source": row.get("source", "").strip(),
                    "signup_date": row.get("signup_date", "").strip(),
                })
    return leads


def load_state():
    if STATE_FILE.exists():
        with open(STATE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_state(state):
    with open(STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)


def send_email(to_email, to_name, template_id):
    """Send transactional email via Brevo API."""
    payload = {
        "to": [{"email": to_email, "name": to_name or "Pengguna"}],
        "templateId": template_id,
        "sender": {"email": SENDER_EMAIL, "name": SENDER_NAME},
        "params": {"nama": to_name or "Pengguna"},
        "headers": {"X-Mailer": "SiapPsikotes-Drip"},
    }
    headers = {
        "accept": "application/json",
        "api-key": API_KEY,
        "content-type": "application/json",
    }
    try:
        resp = requests.post(API_URL, json=payload, headers=headers, timeout=15)
        if resp.status_code == 201:
            return True, resp.json().get("messageId")
        else:
            return False, f"HTTP {resp.status_code}: {resp.text}"
    except Exception as e:
        return False, str(e)


def main():
    if not API_KEY:
        # Secret belum diisi. Jangan keluar dengan kode 1: workflow ini cron harian,
        # jadi tiap kegagalan mengirim email "Run failed" ke pemilik repo. Lewati saja.
        print("[skip] BREVO_API_KEY belum diisi - tidak ada email yang dikirim.")
        print("[skip] Isi secret BREVO_API_KEY, BREVO_SENDER, dan BREVO_TPL_1..5 di")
        print("[skip] Settings > Secrets and variables > Actions untuk mengaktifkan drip.")
        return

    today = date.today().isoformat()
    leads = load_leads()
    state = load_state()

    sent_today = 0
    for lead in leads:
        email = lead["email"]
        if sent_today >= DAILY_CAP:
            print(f"[info] Daily cap {DAILY_CAP} reached, stopping")
            break

        st = state.get(email, {"step": 0, "last_sent": None, "status": "active"})
        if st.get("status") != "active":
            continue

        current_step = st.get("step", 0)
        if current_step >= 5:
            continue  # sequence complete

        next_step = current_step + 1
        # Only send if last_sent was before today (daily cadence)
        if st.get("last_sent") == today:
            continue

        template_id = TEMPLATE_MAP.get(next_step)
        if not template_id:
            print(f"[warn] No template_id for step {next_step}")
            continue

        ok, msg = send_email(email, lead["nama"], template_id)
        if ok:
            print(f"[ok] {email} step {next_step} sent (msgid: {msg})")
            state[email] = {
                "step": next_step,
                "last_sent": today,
                "status": "active",
                "nama": lead["nama"],
                "source": lead.get("source", ""),
            }
            sent_today += 1
        else:
            print(f"[fail] {email} step {next_step}: {msg}")
            # Don't increment step on failure — retry next run

    save_state(state)
    print(f"[done] Sent {sent_today} emails today")


if __name__ == "__main__":
    main()
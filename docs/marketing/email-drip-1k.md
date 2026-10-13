# Email Drip 1K Leads — Strategi 5-Step Sequence

**Target:** 1.000 lead yang punya email valid (signup /beli/, lead magnet, referral).  
**Channel:** Brevo (SendinBlue) free tier — 300 email/hari.  
**Schedule:** 1 email/hari per lead → 5 hari full sequence.  
**Throughput:** 300/hari × 5 email = 1.500 email/hari kapasitas. Untuk 1.000 lead butuh ~17 hari selesai.

---

## 5-Email Sequence (Permission Marketing — Seth Godin)

| Email | Hari | Subject | Angle | CTA |
|-------|------|---------|-------|-----|
| 1 | 0 | Selamat datang di SiapPsikotes 🎯 | Value-first: latihan gratis 10 soal | [Coba 10 Soal Gratis] |
| 2 | 1 | Kenapa 89% lulusan kedinasan latihan di sini? | Social proof + authority | [Lihat Bukti Skor] |
| 3 | 2 | Soal mana yang paling susah? (Kunci di sini) | Education: breakdown tipe soal | [Buka Pembahasan] |
| 4 | 3 | Flash Sale: Akses penuh Rp 19.000 (akhir pekan) | Urgency + discount | [Ambil Akses 19K] |
| 5 | 4 | Masih ragu? 3 alasan kenapa wajib latihan sekarang | Objection handling | [Mulai Latihan Sekarang] |

**Prinsip:** Setiap email kasih nilai dulu (permission), jual kemudian. No spam, no hype.

---

## Teknis

- **State tracking:** `leads/state.json` — `{ "email": "lead@x.com", "step": 2, "last_sent": "2026-10-13", "status": "active" }`
- **Daily cron:** GitHub Actions 01:00 UTC (08:00 WIB) — baca state, kirim email ke step berikutnya untuk lead yang `last_sent < today`.
- **Rate limit:** max 300/hari (Brevo free). Script berhenti pas cap.
- **Idempotent:** deduplikasi via `email+step` key. Re-run aman.
- **Unsubscribe:** link di footer setiap email → update status `unsubscribed`.

---

## Brevo Setup (Zero Cost)

1. Daftar brevo.com → free plan (300 email/hari).
2. Verify domain `siappsikotes.my.id` (DKIM/SPF).
3. Create API key (v3) → simpan di GitHub Secrets: `BREVO_API_KEY`.
4. Create 5 email templates di Brevo (drag-drop atau HTML) → catat `template_id` 1-5.
5. Atur sender: `noreply@siappsikotes.my.id`.

---

## KPI

- Open rate ≥ 25%
- Click rate ≥ 5%
- Unsubscribe ≤ 1%
- Konversi /beli/ dari drip ≥ 2%

---

## Files

- `scripts/email-drip.py` — core sender
- `.github/workflows/email-drip.yml` — daily cron
- `leads/state.json` — persistent state (committed by workflow)
- `leads/leads.csv` — source (email, nama, source, signup_date)
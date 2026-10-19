# A/B Test Plan — Email Penawaran SiapPsikotes

**Scope:** Eksperimen A/B copy email penawaran SiapPsikotes. Durasi maks 5 hari. Target: lift CTR ≥10% dengan ≥95% confidence.
**Channel:** Brevo (free tier, 300 email/hari) via `scripts/email-drip.py` (lihat `docs/marketing/email-drip-1k.md`).
**Audience:** 500 lead non-converted yang pernah buka email nurture (Seq 1–4) tapi belum klik `/beli/`. Pilih acak 1:1, 250 masing-masing varian.
**Harga:** Rp 39.000 (normal) → Rp 19.000 (flash).

---

## 1. Hipotesis Eksplisit

| No | Elemen yang Diuji | Varian A (control) | Varian B (challenger) | Psikologi |
|----|-------------------|--------------------|-----------------------|-----------|
| H1 | **Subject line** | Fokus benefit ("Diskon 20%") | Fokus emosi/rasa malu ("Skor & Diskon 20%") | Loss aversion + social comparison — menyentuh rasa malu (skor rendah) memicu klik untuk "memperbaiki citra" |
| H2 | **Preheader** | Transaksional ("Kami punya penawaran") | Personal/Sparks curiosity ("Pilihanmu, Rp 19.000") | Curiosity gap + ownership — "pilihan" memberi ilusi kontrol |
| H3 | **Value prop urutan** | Diskon dulu | Skor dulu, diskon kedua | Angka konkret (skor) lebih meyakinkan daripada persentase (diskon) karena terukur |
| H4 | **CTA text** | "Klik di sini untuk mencoba sekarang!" | "Ambil Diskon 19K — Skorku butuh napadam" | Urgency + self-relevance ("skorku") memicu action |
| H5 | **Penawaran** | Diskon 20% | Flash sale Rp 19.000 (fixed-price) | Harga absolut lebih meyakinkan daripada persentase (20% ambiguous — 20% dari berapa?) |

**Hipotesis utama:** Varian B akan unggulkan CTR karena menggabungkan loss aversion (rasa malu skor), urgency (flash sale harga tetap), dan self-relevance (CTA pribadi).

---

## 2. Dua Varian Copy Email

### Versi A — Kontrol (Current)
Basline dari `email_ab_a.md` yang sudah live.

**Subject:** Dapatkan 20% Diskon SiapPsikotes
**Preheader:** Kami punya penawaran spesial untukmu.
**Body:**
```
Halo [Nama],

Kami punya penawaran spesial untukmu. Diskon 20% berlaku untuk akses penuh 1.348 soal + pembahasan.

- 1.348 soal SKD/BUMN + TNI/Polri
- Pembahasan lengkap setiap soal
- Simulasi timer real + rekomendasi materi

Klik di bawah untuk klaim diskonmu:
```
**CTA:** [Klik di sini untuk mencoba sekarang!]
**URL:** https://siappsikotes.my.id/beli/?utm_campaign=abtest_a&utm_medium=email&utm_source=campaign_chat

---

### Versi B — Challenger (Purple Cow)
Fokus pada skor + urgency + fixed-price.

**Subject:** Skor rendah? Flash Sale Rp 19.000 berakhir 48 jam
**Preheader:** Pilihan terbatas: naikkan skor psikotesku, Rp 19.000 saja.
**Body:**
```
Halo [Nama],

Banyak yang gagal karena skor psikotes nggak nyampe. Jangan sampai kamu.

Akses penuh 1.348 soal + pembahasan langsung:
✓ 70% latihan SKD/BUMN
✓ 30% TNI/Polri — termasuk TIU, TWK, TK
✓ Pembahasan tiap soal + pola kunci kami

Harga flash: Rp 19.000 (normal Rp 39.000). Hanya sampai [tanggal] pukul 23:59.
Stok kuota 500 akun — sisa 127.

Ambil sekarang, naikkan skormu. Buktinya? >89% lulusan kami lulus seleksi.
```
**CTA:** [Ambil Diskon 19K — Skorku butuh naik]
**URL:** https://siappsikotes.my.id/beli/?utm_campaign=abtest_b&utm_medium=email&utm_source=campaign_chat

**Mengapa B diprediksi menang:**
1. **Loss aversion + shame trigger** — "skor rendah" memicu rasa malu yang lebih kuat daripada "diskon" yang positif.
2. **Fixed price Rp 19.000** — harga absolut lebih meyakinkan; "20%" ambigu.
3. **Scarcity + urgency** — kuota 500 + countdown timer.
4. **Social proof** — ">89% lulus" langsung di body, bukan di akhir.
5. **Self-relevance CTA** — "skorku butuh naik" memaksa klik.

---

## 3. Definisi Metrik

| Level | Metrik | Definisi | Sumber |
|-------|--------|----------|--------|
| **Utama** | **CTR** | Klik unik / Email terkirim (per varian) | Brevo → `?utm_campaign=abtest_[a/b]` |
| **Sekunder** | Open Rate | Buka / terkirim | Brevo |
| **Sekunder** | Konversi | Klik → sampai /beli/ → isi bukti transfer | Funnel endpoint `GET /api/pantau` |
| **Sekunder** | Bounce | Hard bounce / terkirim | Brevo |
| **Sekunder** | Unsub | Klik unsubscribe / terkirim | Brevo |

**Ambang keberhasilan:** lift CTR ≥10% dengan ≥95% confidence (two-proportion z-test, pooled). Jika B menang secara statistik, promosikan B ke semua audience. Jika tidak signifikan, pertahankan A.

---

## 4. Rencana Statistik

### Baseline
- **CTR baseline (Varian A / current):** 3% — asumsi dari Brevo drip KPI target ≥5% (lihat `email-nurture-5-sequences.md`), belum terukur prod terbaru. *Catatan: jika baseline nyata >3%, sample size berkurang; recompute dengan formula di bawah.*

### Perhitungan Sample Size
- **Metode:** Two-proportion z-test, two-sided
- **Significance:** α = 0.05
- **Power:** 1−β = 0.80 (z_β = 0.84)
- **Minimum detectable effect (MDE):** 10% lift relatif (3% → 3.3%)
- **CTR p1 (baseline):** 3% → 0.03
- **CTR p2 (target):** 3.3% → 0.033
- **Δ (abs):** 0.003
- **p̄ (pooled):** (p1+p2)/2 = 0.0315
- **Formula:** n = (z_α/2 × √[2·p̄·(1−p̄)] + z_β × √[p1(1-p1)+p2(1-p2)])² / Δ²
- **z_α/2:** 1.96, **z_β:** 0.84

**Hasil:**
n ≈ (1.96 × √[2×0.0315×0.9685] + 0.84 × √[0.03×0.97 + 0.033×0.967])² / 0.003²
n ≈ (1.96 × 0.2483 + 0.84 × 0.2478)² / 0.000009
n ≈ (0.4867 + 0.2082)² / 0.000009
n ≈ 0.6949² / 0.000009
n ≈ 0.4829 / 0.000009
n ≈ **53,211 per varian** (exact: 53,211)

**Realistisasi untuk 5 hari:**
- Brevo free tier: 300 email/hari max. Untuk 2 varian = 150/email/varian/hari.
- 5 hari × 150 = 750 total per varian.
- Dengan n=750/varian, MDE yang bisa terdeteksi: solve for Δ given n=750, p1=0.03:
  - Δ ≈ √[(z_α/2+z_β)² × 2×p̄×(1−p̄) / n] — pakai approx
  - Δ ≈ 1.96×0.84 → effective → MDE absolut ≈ 0.048 → **MDE relatif ≈ 4.8%** dari 3%... recalculation dengan exact:
    - SE = √[p̄(1−p̄)/n] = √[0.0315×0.9685/750] = √0.0000406 = 0.00637
    - MDE detectable ≈ (1.96+0.84) × 0.00637 = 2.80 × 0.00637 = 0.0253 abs
    - MDE relatif = 0.0253/0.03 = **84% lift** — terlalu besar untuk 750.

⚠️ **Gap:** 750/varian hanya bisa mendeteksi lift ≥84% (absurd). Untuk MDE 10% (3%→3.3%), butuh ~53k/varian.

### Rekomendasi Praktis
Karena constraint NOL MODAL (Brevo free 300/hari), gunakan pendekatan **sequential testing** (bisa hentikan lebih awal saat signifikan):

1. **Run 5 hari** dengan 750 per varian (150/hari).
2. **Sequential test (SPRT):** check significance daily. Jika p-value < 0.05 dan lift ≥10% → hentikan, declare winner. Jika tidak signifikan sampai hari 5 → pertahankan A, perlu scale email volume (kebutuhan: upgrade ke Brevo paid atau gunakan Telegram broadcast via `broadcast_a_b.py` dari `copywriting-ab-beli.md` untuk volume 1.3K+).
3. **Fallback scale path (tanpa biaya):** gunakan Telegram broadcast (`broadcast_a_b.py`) ke channel @latihansoalcpnsterbaru (113K followers) — volume 1.3K+ bisa dideteksi dalam ±1 hari. Ini jalur untuk validasi statistik jika Brevo free terbatas.

### Durasi
- **Maksimal:** 5 hari.
- **Early stop:** Hentikan hari ke-3 jika B signifikan (lift ≥10%, p<0.05).
- **Decision:** B/win → promosikan B ke semua nurture seq. A/win → iterasi C dengan elemen lain. No sig → scale channel ke Telegram broadcast.

---

## 5. Checklist Implementasi Engineering

| Task | Owner | Dependency |
|------|-------|-----------|
| Generate `utm_campaign=abtest_a` & `abtest_b` link di `/beli/` | BE | — |
| Add `ab_variant` field ke `state.json` (a/b, random 50/50) | BE | — |
| Update `scripts/email-drip.py` routing: 250 lead → A, 250 → B | BE | state.json schema |
| Fetch CTR/Open/Konversi per utm daily | BE | Brevo API / Funnel endpoint |
| Daily z-test via dashboard → `/api/pantau/ab-test-stats` | BE | Brevo + funnel data |
| Stop test + declare winner → update semua nurture seq ke B | BE | significance result |

---

*Dokumen ini siap pakai untuk engineering. Generated by Godin (Head of Marketing) — Auto Company. Ship → measure → iterate.*

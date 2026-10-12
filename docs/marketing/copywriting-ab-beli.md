# Copywriting A/B Test — Halaman /beli/ SiapPsikotes

Tujuan: uji 2 varian copywriting halaman /beli/ (SiapPsikotes) untuk naikin CTR funnel QRIS.
Fokus: akuisisi gratis. Goal: >=20 pengunjung baru/tayang, >=2 pembelian baru.

## Varian A — "Coba Latihan Gratis"
- **Judul**: Siap Ujian Psikotes? Coba Latihan Gratis Sekarang!
- **Isi**: Tingkatkan peluang sukses kerja impian dengan latihan soal psikotes langsung dengan pembahasan. Klik di bawah untuk mulai gratis!
- **CTA**: [Coba Latihan Gratis]

## Varian B — "Tingkatkan Skormu"
- **Judul**: Siap Ujian Psikotes? Tingkatkan Skormu Sekarang!
- **Isi**: Latihan soal psikotes SKD/BUMN langsung dengan pembahasan lengkap. Mulai persiapanmu gratis!
- **CTA**: [Mulai Gratis Sekarang]

## Broadcast script
Lihat: `broadcast_a_b.py` (attachment t_adf316d9, id 51).
Baca leads dari CSV, kirim via Telegram Bot API, state di `broadcast_state.db` (idempotent).

## Tracking
- Endpoint pelacakan funnel: `https://siappsikotes-api.rasyidahmad180.workers.dev/api/pantau`
- Event valid: `kunjungan_beli`, `tampilkan_kode`, `klik_bukti_wa`, `klik_bukti_email`, `buka_aplikasi`, `salin_kode`, `salin_nominal`, `klik_cta_bayar`.
- Query ringkasan: GET `/api/pemilik/funnel` -> `per_jenis`, `per_hari`.

## Rekomendasi channel (CAC terendah, gratis)
1. Telegram channel @latihansoalcpnsterbaru (113K) — broadcast script.
2. Telegram channel @latihansoalbumn (67.8K) — varian B.
3. Instagram @ujian.psikotes (94K) — story + link /beli/.

## Keputusan
- Varian A = fokus "gratis" + "latihan langsung".
- Varian B = fokus "skor" + "SKD/BUMN".
- A/B via Telegram broadcast, alternating per lead.
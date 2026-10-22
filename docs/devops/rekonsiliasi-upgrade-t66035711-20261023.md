# Upgrade cron rekonsiliasi harian (t_66035711)

Tanggal: 2026-10-23 (WIB). Commit `396d890` (di origin/master, di atasnya cap aset
`97d81ac` oleh peer). Worker `siappsikotes-api` versi live: `6ad9b77e-2148-4ac6-ae1d-998cf9d21daa`.

## Yang live

1. **Filter klaim is_test** — `rekonsiliasiRingkasan` mencocokkan rujukan dengan
   peristiwa `beli:klaim_bayar`; event `is_test=1` → baris status `uji`
   (`alasan: klaim_is_test`), dikecualikan dari SEMUA hitungan uang. Ringkasan baru:
   `uji` + `uji_24jam`. Laporan Telegram menyebut jumlah klaim uji bila > 0.
2. **Auto-terbit kode** (`autoTerbitkanKlaimCocok`, dijalankan di awal rekonsiliasi):
   klaim `asal='klaim'` yang cocok pembayaran NYATA (is_test=0) naik ke
   `asal='klaim-cron'` (anggota `ASAL_LUNAS`, tidak menyentuh skema
   `klaim-webhook`/`webhook-auto` milik t_3a03d4b4; `kodeBatch2Sah` ikut diperbarui).
   - Jalur A `rujukan`: muatan menyebut rujukan sama + nominal sama
     (dengan jaga minimal terbit −5 menit).
   - Jalur B `nominal`: nominal sama dan TEPAT SATU muatan dalam ±12 jam dari jam
     klaim; ambigu (≥2) dibiarkan untuk pemilik.
   - Muatan yang sudah terpakai satu klaim tidak diambil klaim lain dalam satu run.
   - Saat naik: peristiwa `beli:match_cron` (jalur dicatat di rincian) +
     `terbitkanKodeRef` (idempoten).
   - Klaim uji (`beli:klaim_bayar` is_test=1) TIDAK pernah naik — probe QA tidak
     bisa "terbayar" oleh muatan asli. (Bug ini tertangkap uji lokal.)
3. **CSV bukti run** — `GET /api/rekonsiliasi-ringkasan?token=<LAPORAN_TOKEN>&format=csv`
   → text/csv: blok ringkasan + tabel klaim (rujukan, kode_akhir, nominal, kontak,
   klaim_waktu, status, alasan, nominal_masuk, tunggu_jam, payments). Link kini
   dibawa laporan Telegram pagi. Terverifikasi LIVE: HTTP 200 text/csv
   (2026-10-22T17:45Z, klaim tertunda 0 — konsisten: SP-888 data uji operatore
   sudah dihapus, tak ada klaim nyata tertunda). Token salah → 403.

## Uji

- Harness lokal `uji-rekons.mjs` (import Worker asli, D1/KV palsu in-memory):
  11/11 PASS — naik jalur rujukan, naik jalur nominal, ambigu tetap menunggu,
  status uji dikecualikan, 2 peristiwa match_cron is_test=0, 2 kode ref terbit,
  CSV berisi uji + ringkasan, token salah 403.
- `tests/test_verifikasi.py` exit 0; gerbang repo pre-push: SEMUA LULUS
  (penolakan push pertama = rebutan port 8791 antar-uji Playwright paralel, bukan
  produk — dijalankan serial).

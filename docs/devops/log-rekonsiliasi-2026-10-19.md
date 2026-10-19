# Run log — rekonsiliasi klaim "Sudah bayar" (t_4e6c7de6)

Tanggal: 2026-10-19 · Deploy worker version `f05f42d3` (baru.getVersion terakhir 1c86f25 di master)

## Yang diterbitkan
- Endpoint `GET /api/rekonsiliasi-ringkasan?token=<LAPORAN_TOKEN>&hari=N`
  - `curl` bukti: HTTP 200 + JSON ringkasan/klaim; tanpa token → 403.
  - Status per klaim: `tercocok` (payments is_test=0, rujukan+nominal sama) atau
    `butuh_pemilik` (`alasan` = `tanpa_pembayaran` / `nominal_beda`), lengkap
    wait-time jam, kontak klaimer, detail payment (txid/timestamp).
- Cron 08:00 WIB: TIDAK memakai trigger baru (akun free sudah genap 5 cron trigger,
  percobaan pertama `55 1 * * *` ditolak limit 10072 — dipulihkan ke 2 trigger).
  Dijadwalkan dari kode saat cron `*/10` jatuh di jam 8 WIB + guard KV
  `rekons:pagi:<tanggal-WIB>` sekali/hari. Uji manual: `POST /api/dashboard/rekons-coba?token=`
  → terkirim:true (TG) + KV guard tercatat.
- Konten pesan cron: angka 24 jam, daftar klaim >6 jam belum nyambung (+ kontak,
  link cek QR/transfer siappsikotes.my.id/beli/), backlog >24 jam ditandai untuk
  tindak lanjut tim MARKETING.
- Jalur A Tripay: tetap 503 fail-closed (verify `curl` `/api/tripay/transaksi` → 503,
  `/api/tripay/webhook` → 503). Pengingat "Tripay belum dikonfigurasi" maksimal
  1×/hari (KV `alert:tripay-setup:<tanggal-WIB>`), tidak ikut membludak alarm monitoring.
- Kontak klaimer: `prompt()` opsional di halaman /beli/ sekali per rujukan,
  disanitasi `[\w@+.\-\s]{1,64}`, disimpan kolom baru `kode_terbit.kontak`
  (migrasi D1 remote sudah dijalankan: ALTER verified via PRAGMA).
  Perubahan kolom juga di schema.sql + server/migrasi-rekonsiliasi.sql.

## Bukti uji end-to-end (dilakukan lalu DIBERSIHKAN dari produksi)
- Klaim nyata SP-001 via `/api/beli/kode` → klaim (kontak UJI-REKONS) → tabel menampilkan
  butuh_pemilik saat payments is_test=1 (filter is_test terbukti);
  setelah payments uji diubah is_test=0 + nominal sama → `tercocok`, tunggu 0 jam.
- Screenshot tabel saat berisi baris uji: `docs/devops/rekonsiliasi-dashboard.png`
  (dibaca kembali via vision: baris SP-001 tercocok, kontak terbaca).
- Bersih-bersih: DELETE payments uji, kode_terbit SP-001, referral SP-001,
  konversi, peristiwa SP-001 → rekonsiliasi kembali 0/0/0, `/api/dashboard/stats` 0.

## Catatan lingkungan
- Dashboard internal `/dashboard/` sebelumnya mengarah worker `arapcihuy.workers.dev`
  (HTTP 000/dead) → diperbaiki ke `rasyidahmad180.workers.dev` (200).
- Commit master: `1c86f25` (+ bagian worker terbawa commit rekan `e6b51e2`).

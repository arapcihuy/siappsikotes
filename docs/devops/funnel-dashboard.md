# Dashboard Funnel Harian 1-URL — SiapPsikotes

## URL (1 GET, tanpa login)

    https://siappsikotes.my.id/api/funnel

Satu JSON terbuka: funnel harian /beli/ — kunjungan, klik bayar, QRIS dibuat,
pembayaran terkonfirmasi (webhook), cart-abandon, revenue, konversi.
Lengkap dengan kolom `definisi` supaya angka tidak disalahartikan.

## Cara kerja (boring technology)

- Data sumber: D1 `siappsikotes-db` — tabel `peristiwa` (event `/api/pantau`:
  `beli:kunjungan_beli`, `beli:klik_cta_bayar`, `beli:qris_tampil`) dan tabel
  `payments` (webhook pembayaran, status `success`/`paid`).
- Snapshot KV: cron Worker tiap 6 jam menulis `funnel:terkini` ke KV `FUNNEL_KV`
  (namespace `c353a135b34e49db932341040b371a1d`, tier gratis).
- GET /api/funnel membaca snapshot KV; kalau kosong (KV baru/baru dibersihkan),
  hitung langsung dari D1 lalu menulis snapshot sendiri (pulih sendiri).

## Jadwal snapshot & batas cron gratis

Batas akun Cloudflare Free: 5 cron trigger per akun — sudah terpakai penuh
(Cardcheck + monitoring). Karena itu snapshot TIDAK punya cron fisik sendiri;
ia menunggangi cron `*/10 * * * *` yang sudah ada di `server/wrangler.toml`:

    if (kini.getUTCHours() % 6 === 0 && kini.getUTCMinutes() <= 10) await simpanSnapshotFunnel(env);

Efeknya: snapshot ditulis saat jam 00/06/12/18 UTC (menit 0-10) = tiap 6 jam,
= 07/13/19/01 WIB. Cron fisik tetap 2: `*/10 * * * *` dan `55 16 * * *`.

## Operasi

- Lihat angka sekarang: `curl https://siappsikotes.my.id/api/funnel`
- CSV 30 hari: `GET /api/dashboard/funnel-csv` (sudah ada sebelumnya)
- Deploy ulang worker: `cd ~/tni-belajar/server && wrangler deploy`
- Ganti jadwal snapshot: edit kondisi `getUTCHours() % 6` di
  `server/src/index.js` (fungsi `scheduled`), lalu deploy ulang.

## Insiden yang pernah terjadi (catatan deploy)

Deploy pertama gagal memasang trigger cron ke-3: Cloudflare API 400,
kode 10072 "Workers Free limit of 5 cron triggers per account".
Solusi: tanpa menambah trigger fisik — snapshot dijadwalkan dari kode
(lihat atas). Tidak ada biaya, tidak ada perubahan perilaku monitoring.

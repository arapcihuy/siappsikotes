# Pelacakan Konversi /beli/ — Server-Side via Cloudflare Worker + D1

Tanggal: 2026-10-09
Status: **Live**

## Ringkasan
Menambahkan tracking funnel pembelian di halaman `/beli/` tanpa analitik pihak ketiga baru. Semua event tercatat server-side via Worker `siappsikotes-api` → tabel `peristiwa` di D1. Cloudflare Web Analytics tidak mendukung custom event → memakai log event internal yang sudah ada.

## Arsitektur
`beli/index.html` (Cloudflare Pages, statis)
  → sendBeacon / fetch keepalive POST ke `https://siappsikotes-api.rasyidahmad180.workers.dev/api/pantau`
  → `server/src/index.js` (Cloudflare Worker)
     → rate-limit 60/mnt/IP + whitelist `Origin`
     → validasi jenis event & `rujukan` `SP-###`
     → INSERT `peristiwa(pengguna,jenis,rincian,waktu)`

Ringkas data pemilik: `GET /api/pemilik/funnel-beli` (butuh session pemilik)

## Event
- `kunjungan_beli` — load halaman
- `klik_cta_bayar` — klik “Lihat QRIS bayar”
- `salin_nominal` — copy nominal
- `tampilkan_kode` — klik “Ambil kode akses”
- `salin_kode` — copy kode
- `buka_aplikasi` — klik “Buka aplikasi”
- `klik_bukti_wa` — klik kirim bukti via WA
- `klik_bukti_email` — klik kirim bukti via email

Semua disertai `rujukan` SP-### (tidak menyimpan data pribadi).

## Endpoint
- POST `https://siappsikotes-api.rasyidahmad180.workers.dev/api/pantau`
  Body JSON: `{ jenis: string, rujukan: string }`
  Validasi: jenis whitelist, rujukan `^SP-\d{3}$`, Origin `siappsikotes.my.id`
  Rate limit: 60 event/menit/IP (tabel `batas`)

- GET `https://siappsikotes-api.rasyidahmad180.workers.dev/api/pemilik/funnel-beli`
  Ringkasan: per jenis (jumlah & rujukan unik) + breakdown harian.

## Keamanan & Privasi
- Tidak ada cookie, sidik jari, atau data PII.
- IP hanya dipakai untuk rate-limit; tidak disimpan bersama event (prop `pengguna` disimpan null).
- CORS hanya untuk origin situs; pre-flight dicegah untuk POST event.

## Deploy
`cd server && npx wrangler deploy` → Version ID `50338161-1df3-4bde-8228-4ae3036370f7`

Commit: `200e490` pushed ke `master`.

## Verifikasi
- Curl valid → 200 `{ok:true}`
- Jenis tidak dikenal → 400 `{pesan:"jenis tidak dikenal"}`
- Browser hit `https://siappsikotes.my.id/beli/` → beacon `/api/pantau` tercatat di Performance.
- D1 query `SELECT jenis, COUNT(*) FROM peristiwa WHERE jenis LIKE 'beli:%' GROUP BY jenis;` menghasilkan baris.

## Catatan
Cloudflare Web Analytics (rum-beacon) hanya pageview otomatis; tidak ada API custom event. Solusi ini memakai infrastruktur yang sudah ada (Worker + D1 `peristiwa`) untuk memenuhi kebutuhan tracking konversi tanpa dependensi baru. YAGNI terpenuhi: logging minimal, error-proof, tidak mengganggu alur pembelian.

## Filter is_test (2026-10-20)
Kolom `peristiwa.is_test` (migrasi `server/migrasi-peristiwa-is-test.sql`) menandai beacon berasal dari trafik test/probe/audit: `utm_source` berawalan `uji-`, `probe`, `audit`, `verify-task`, atau `test` (case-insensitive), atau payload membawa `is_test` eksplisit dari alat internal. Semua readout funnel/A/B (`/api/pemilik/funnel-beli`, `/api/dashboard/stats`, `/api/dashboard/conversion`, `/api/laporan/funnel`) hanya menghitung baris `is_test = 0`, sehingga metrik CTR/konversi tidak tercemar beacon sendiri (pola sama dengan `payments.is_test`).

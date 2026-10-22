# Spesifikasi teknis — Simulasi Tryout (/simulasi-tryout/)

Status: **Live** · Rilis 2026-10-23 · Tugas board t_ec85dbfb
Pemilik produk: Norman (Head of Product) · Implementasi: satu halaman statis + satu perubahan Worker.

## 1. Tujuan & posisi produk

- Fitur premium baru yang berdiri sebagai **anchor upsell paket akses Rp 39.000** di /beli/.
- Nilai yang dijual (netral & jujur): **latihan berformat ujian** — jumlah soal tetap,
  **fitur timer** mundur, hasil **skor akhir + rincian per mata uji** untuk **melihat area terlemah**.
- Sudut jual: latihan biasa membiarkan pengerjaan lepas — di hari ujian justru waktu yang
  terbatas. Sesi berformat ujian melatih distribusi waktu, bukan hanya substansi jawaban.
- Segmen: pemegang kode akses (sesi penuh 120) dan umum (demo gratis 20).

## 2. Bentuk halaman

Satu berkas: `simulasi-tryout/index.html`. Tanpa dependensi baru, tanpa framework,
tanpa perubahan aplikasi utama. Struktur:

- Hero: judul, penjelasan format 120 soal/120 menit, penyangkalan instansi.
- Strip angka: 120 soal · 120 menit · 6 mata uji · rincian per mata uji.
- Alur penggunaan 3 langkah (demo gratis → sesi penuh berkode → baca pembahasan).
- Panel ujian: timer, kemajuan, kartu soal, opsi A–D, navigasi, peta nomor soal,
  tombol "Selesai & lihat skor" (dengan dialog konfirmasi).
- Hasil sesi: skor besar (persen benar), tabel per mata uji, sorotan mata uji terlemah,
  tombol ulangi (soal diacak ulang), tautan pembelian dengan utm, pembahasan tiap soal.
- Bagian upsell + FAQ + catatan kualitas bank soal.

CSP meta sama dengan halaman landing lain, dengan `connect-src` menambah
`https://siappsikotes-api.rasyidahmad180.workers.dev` untuk beacon.

## 3. Data soal

- Sumber: berkas yang sama dengan aplikasi utama — `data/soal-<kategori>.js`
  (hasil generate `tools/pecah-data.py` dari `data/soal.js`); tidak dibuat salinan data kedua.
- Enam kategori teks dipilih supaya renderer sederhana dan bebas tebakan tampilan:
  TWK 203 · Matematika 166 · Bahasa Inggris 130 · Penalaran & Logika 134 ·
  Numerik 184 · Verbal 140 (total 957 butir di bank). Soal yang punya gambar
  (6 butir di kategori ini) ikut dirender.
- Kraepelin, Tes Gambar, Kepribadian, dan bank batch-2 tetap milik aplikasi utama —
  tidak dipindah dan tidak diturunkan cakupannya.
- Komposisi sesi penuh (tetap, diperlihatkan jujur di halaman):

  | Mata uji (maka kategori data) | Jumlah |
  |---|---|
  | Wawasan Kebangsaan (`tkw`) | 30 |
  | Matematika | 25 |
  | Bahasa Inggris | 16 |
  | Penalaran & Logika | 18 |
  | Kemampuan Numerik | 21 |
  | Kemampuan Verbal | 10 |
  | **Total** | **120** |

- Demo: 5/4/3/3/3/2 = 20 soal, timer 25 menit.
- Soal diacak tiap sesi; kunci tidak tampil selama pengerjaan (terkunci, seperti tryout aplikasi utama).
- Gate yang dijalankan sebelum rilis: `tools/peraturan-mutu.py` (P1–P11),
  `tools/verifikasi-soal.py` (verifikasi akurasi), `tools/periksa-copy-beli.py`
  (disiplin copy diperluas ke halaman baru — lihat §8).

## 4. Gerbang premium

- `punyaAksesSim()`: membaca `localStorage.tni_kode_akses`, memeriksa struktur =
  **sidik yang sama persis** dengan `static/js/fitur11.js` (`KUNCI_KODE = 'siap|psikotes|2026|kode'`).
- Kode sah yang ditempel di halaman disimpan ke `localStorage.tni_kode_akses` — kode yang sama
  yang dikenali aplikasi utama, jadi tidak ada sistem kode kedua.
- Tombol "Sesi penuh" bagi yang belum punya akses mengarahkan ke
  `/beli/?utm_source=simulasi_tryout&utm_medium=tombol_penuh&utm_campaign=upsell-tryout`.

## 5. Pelacakan event (tanpa infrastruktur baru)

Beacon dari halaman ke `POST /api/pantau` (Worker `siappsikotes-api`), pola sama dengan /beli/:

| Event (jenis di peristiwa) | Kapan | rincian |
|---|---|---|
| `tryout:tryout_kunjungan` | Muat halaman | id anonim 8 hex (localStorage `tni_sim_lacak`) |
| `tryout:tryout_klik_beli` | Klik tautan /beli/ | `id:<id anonim>` |

- utm (source/medium/campaign) dibaca dari query string halaman dan disimpan di kolom utm tabel.
- `is_test` mengikuti deteksi utm `uji-/probe/audit/verify-task/test` yang sudah ada.
- Tanpa cookie pelacak dan tanpa PII.

Perubahan Worker: whitelist `JENIS_PANTAU` di `server/src/index.js` bertambah
`'tryout_kunjungan'` dan `'tryout_klik_beli'`; rujukan untuk jenis tryout memakai pola bebas
`[A-Za-z0-9_-]{1,20}` (kelas yang sama dengan cardcheck) dan awalan jenis `tryout:`.
Halaman itu sendiri dilayani origin statis — tidak ada route Worker baru untuk lalu lintasnya.

## 6. Deploy

1. Push commit ke `master` (GitHub Pages, domain Cloudflare siappsikotes.my.id) → halaman statis live.
2. `cd server && npx wrangler deploy` → whitelist event aktif di produksi.
3. Verifikasi live: buka URL halaman dengan utm namanya sendiri, pastikan muncul barisnya di
   `/api/laporan/funnel?format=csv?token=...` (CSV funnel harian `is_test = 0`) — file CSV yang
   di-export `scripts/ekspor-funnel.sh` di `docs/devops/ekspor/`.

## 7. Metrik keputusan

- `tryout:tryout_kunjungan` per minggu — menunjukkan menarik atau tidak fitur ini.
- Rasio `tryout:tryout_klik_beli / tryout_kunjungan` — keefektifan anchor terhadap minat beli.
- Konversi kunjungan /beli/ milik `utm_campaign=upsell-tryout` — atribusi via kolom utm D1.
- Keputusan lanjutan hanya diambil bila data ≥ 30 kunjungan non-uji (baris `is_test = 0`).

## 8. Batasan yang diakui terbuka (honest limitation)

- Validasi kode premium berlaku di sisi klien (sidik kode), setara dengan gerbang aplikasi
  utama — bukan perangkat verifikasi pembayaran; pembeli eksternal tetap diperiksa pemilik
  sebelum kode diterbitkan.
- Akses premium di halaman ini mengikuti kode yang tersimpan di perangkat; pengguna yang
  pindah perangkat memakai lewat sinkron kode itu di aplikasi utama.

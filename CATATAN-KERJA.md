# Catatan Kerja — PK Perwira TNI (platform belajar)

Situs: https://arapcihuy.github.io/pk-perwira-tni/  
Repo: https://github.com/arapcihuy/pk-perwira-tni (branch `master`, GitHub Pages)  
Kode kerja lokal: `~/tni-belajar`  
Diperbarui: 2026-09-12

File ini mencatat semua pekerjaan yang dikerjakan otomatis (otonom) pada proyek ini,
supaya mudah ditelusuri kembali: apa yang diubah, kapan, dan hasil verifikasinya.

## Ringkasan isi aplikasi

- 1205 soal, 9 kategori: Wawasan Kebangsaan (203), Matematika (166), Bahasa Inggris (110),
  Penalaran dan Logika (134), Kemampuan Numerik (184), Kemampuan Verbal (100),
  Tes Kraepelin (115, termasuk 15 soal kolom angka bergambar), Tes Gambar dan Visual (80, semua bergambar),
  Tes Kepribadian Situasional (113). Semua soal punya label topik (60+ topik) dan posisi kunci
  tersebar merata (A/B/C/D masing-masing ~25%).
- Fitur: Tryout (60 soal / 90 menit), mode Belajar, Bank Soal + pencarian, Tes Psikologi
  (Kraepelin, Digit Span, Daya Ingat, EPPS), IQ Lab (matriks, deret, rotasi, Dual N-Back),
  Progress, backup/restore data lokal (localStorage), PWA offline (service worker).
- Fitur v21: bank soal salah + pengulangan berjadwal (1-3-7-14-30 hari), rincian hasil per kategori,
  ukuran kecepatan (detik/soal), lanjut sesi, jalur belajar 28 hari, kode sinkron antar perangkat,
  ekspor soal salah (HTML/PDF), tema terang-gelap + ukuran huruf, pintasan simulasi Kraepelin.
- Teknis v21: verifikasi otomatis di CI (`tools/verifikasi-soal.py`), data dipecah per kategori
  (`tools/pecah-data.py` + `static/js/data-loader.js`), versi aset otomatis dari hash commit
  (`.github/workflows/versi.yml`).
- Fitur v22: posisi opsi diacak saat Tryout/Simulasi, kunci dikunci selama ujian, Simulasi Format
  Seleksi (komposisi tetap 60 soal/90 menit), latihan adaptif berbasis tingkat kesulitan nyata,
  mode Hafalan Cepat (kartu bolak-balik 151 kartu TWK), grafik tren nilai 30 sesi + tren per kategori,
  tombol siapkan mode offline, ajakan pasang ke layar utama.
- Teknis v22: uji runtime Chromium otomatis di CI (`tools/uji-runtime.py` + workflow), favicon,
  audit kunci gelombang kedua (pemeriksa independen) yang menemukan 1 kunci salah (w47) dan
  7 soal rapuh lain — semuanya sudah dikoreksi.
- Fitur v23: label topik + filter/drill topik, Skor Kesiapan Ujian, Rencana Harian Otomatis,
  Rapor Kesiapan (bank + psikotes + IQ), riwayat Kraepelin antar sesi, waktu per kategori,
  +30 soal Tes Gambar, +15 soal Kraepelin kolom angka, 6 pembahasan bergambar, halaman Tentang.
- Teknis v23: uji aksesibilitas axe-core + uji mode offline otomatis di CI; landmark <main>;
  verifikasi baru (kunci Kraepelin kolom vs angka di gambar, kelengkapan gambar Tes Gambar).
- Fitur v24: tombol laporkan soal (+ ekspor laporan), pencarian konsep (pembahasan/opsi/topik),
  statistik & drill topik terlemah, target nilai bisa diatur, mode 5 menit, ekspor Rapot Kesiapan,
  pengingat 28 hari (.ics).
- Teknis v24: lint penulisan soal (94 perbaikan), axe nol pelanggaran (landmark footer + dialog),
  anggaran beban muat di CI, uji fitur v24 masuk uji runtime otomatis.
- Fitur v25: Ringkasan Hafalan (58 kiat, bisa dicetak), pembahasan bergambar 32 soal geometri,
  +92 soal (TWK & Kepribadian), insight waktu belajar, halaman riwayat versi, panduan awal 4 langkah.
- Teknis v25: penyeimbangan posisi kunci (A/B/C/D ~25%), workflow pemeriksaan terjadwal mingguan,
  smoke test situs live (`tools/uji-situs-live.py`), uji runtime diperluas.
- Fitur v26: 20 soal reading comprehension, menu Lainnya, alur belajar di halaman Tips,
  mode Jelang Ujian 7 Hari.
- v27: PERATURAN MUTU SOAL resmi + pemeriksa otomatis 10 butir (mengikat di CI); 2 soal yang kuncinya
  bocor di pertanyaan (w74, w112) diperbaiki; 112 soal baru dilengkapi label topik.
- Versi build saat ini: **v41** (fokus ulang: SiapSeleksi — psikotes + tes IQ + SKD) (penanda aset otomatis dari hash commit lewat CI, mis. `?v=5a7a9b0`).
- **Peraturan mutu wajib:** `PEDOMAN-MUTU-SOAL.md` — 10 butir diperiksa mesin (`tools/peraturan-mutu.py`),
  10 aturan proses, aturan isi pembahasan, dan daftar larangan. Wajib lulus sebelum deploy.

## Riwayat pekerjaan otonom

| Tanggal | Perubahan | Commit |
|---|---|---|
| 2026-07-31 | PK Perwira TNI - Platform Belajar PWA; remove bak file, add gitignore; icon: military star design; icon: premium layered military star - dark navy bg, gold star | fix: |
| 2026-08-01 | trigger: force GitHub Pages rebuild; fix: bump service worker cache to v3 - force browser cache invalidation | fix: |
| 2026-08-02 | Mulai bangun bank soal: TWK, MTK, Inggris, Logika, Numerik, Verbal, Kraepelin, Tes Gambar, Kepribadian; perbaikan SVG gambar soal (data URI base64) dan service worker. | fix: |
| 2026-08-04 | Aplikasi tes psikologi TNI AU lengkap ditambahkan. | feat: |
| 2026-08-17 | Perbaikan navigasi dan bug tes psikologi; retry deploy GitHub Pages saat gangguan infrastruktur. | chore: |
| 2026-08-19 | Fitur CAT soal palette, tanda ragu-ragu, kurva kinerja Kraepelin, backup/restore, fullscreen; penguatan sanitasi XSS dan validasi skema backup; perbaikan variabel CSS dan kunci jawaban. | feat(psikologi): |
| 2026-08-27 | Bank soal mencapai 1000 soal + redesign Apple glassmorphism + ikon SVG; perbaikan teks tidak terlihat dan sel Kraepelin aktif. | fix: |
| 2026-09-10 | IQ Lab (drill matriks/deret/rotasi/verbal + Dual N-Back + log skor) dan PWA network-first. Audit menyeluruh build v17 (16 bug diperbaiki: timer tryout, kunci jawaban ganda rotasi figural, bank soal lebih ringan, Kraepelin, import backup) dan v18 (pembahasan di hasil Tes Psikologi). Laporan: `~/Downloads/pk-perwira-audit-2026-09-10/LAPORAN-AUDIT.md`. | feat(v18): |
| 2026-09-12 | Audit akurasi 1000 soal, pembahasan dibuat mudah dipahami, pengecoh dan soal berulang dirapikan, lalu dilanjutkan pengembangan fitur: pengulangan berjadwal, rincian per kategori, kecepatan, lanjut sesi, jalur belajar, sinkron kode, ekspor, tema + huruf, +68 soal baru, +20 gambar, CI verifikasi, data dipecah per kategori, versi otomatis (build v19, v20, v21). Rincian di `LAPORAN-AUDIT.md`. | fix(v21): |

## Cara kerja audit (12 September 2026)

1. `data/soal.js` diekstrak ke bentuk terstruktur (`.audit/extract.py`).
2. Pemeriksaan otomatis: kunci di luar rentang, opsi bernilai sama (soal ambigu),
   hitung ulang aritmetika, kunci tidak disebut di pembahasan, duplikat pertanyaan, gambar rusak.
3. Pemeriksaan manual seluruh 1000 soal per kategori + verifikasi fakta ke sumber luar
   (UU TNI 3/2025, Pasal 36A UUD 1945, Keppres 137/1952, Paskhas 17 Oktober 1947,
   Dakota VT-CLA 29 Juli 1947, Sumpah Prajurit).
4. Perbaikan diterapkan lewat `.audit/fix.py` (idempotent), lalu diverifikasi `.audit/verify.py`.
5. Uji runtime di browser: 9 kategori dijalankan sampai pembahasan muncul, 41 gambar soal
   dimuat, `window.onerror` dipantau (0 error), diuji pada server lokal dan situs live.

Perintah menjalankan ulang:

```bash
/usr/bin/python3 .audit/extract.py         # ekstrak data dari data/soal.js
/usr/bin/python3 .audit/fix.py             # koreksi + format pembahasan + pecah data per kategori
/usr/bin/python3 .audit/verify.py          # verifikasi versi kerja
/usr/bin/python3 tools/verifikasi-soal.py  # verifikasi yang dipakai CI (wajib lulus sebelum push)
```

- v28: uji semua fitur (`tools/uji-fitur-lengkap.py`, 52 pemeriksaan, ikut CI) — menemukan &
  memperbaiki 2 bug: halaman blank saat indeks soal di luar batas, dan tiga panel Progress yang
  hilang total saat data belum ada.

- v29 (Tahap 1 fokus ulang): nama produk netral `SiapSeleksi`, 4 jalur seleksi (Kedinasan/TNI/Polri/CPNS),
  simulasi SKD format resmi 110 soal/100 menit (TWK 30 · TIU 35 · TKP 45), layar Baterai Psikotes (8 modul),
  Tutor Lapisan 0 berbasis materi teraudit (tanpa unduhan), dan kebijakan AI dikunci di kode
  (hanya mengajar, hanya offline, tanpa AI online) + aturan mesin **P11**.

## Hasil verifikasi v29

- 1000 soal, 9 kategori, id unik, semua indeks kunci valid, semua soal 4 opsi.
- 126 soal hitung diuji ulang otomatis: semua cocok dengan kuncinya.
- 95 soal Kraepelin angka: kunci selalu sama dengan angka satuan hasil penjumlahan.
- Tidak ada dua opsi bernilai sama (soal ambigu) dan tidak ada dua soal yang isinya sama persis.
- Pengecoh pada soal pangkat, volume, dan KPK/FPB sudah memakai pola kesalahan hitung yang wajar.
- Semua pembahasan diawali `JAWABAN:` + memuat kunci, format 3 baris: JAWABAN / cara / INGAT.
- 106 gambar soal valid dan ter-render (semua soal Tes Gambar bergambar; 15 soal Kraepelin kolom angka).
- 15 soal kolom Kraepelin diverifikasi otomatis: kunci cocok dengan angka di gambarnya.
- Uji offline di CI LULUS (aplikasi tetap jalan tanpa internet setelah pemuatan pertama).
- Uji aksesibilitas axe: **nol pelanggaran** (sebelumnya 1 moderate).
- Beban muat pertama 344 KB tanpa gzip (16 berkas) — di situs live ~70 KB karena gzip.
- Sebaran posisi kunci merata 25% x 4 posisi (anti tebak), 38 soal dengan pembahasan bergambar.
- Smoke test situs live SEHAT: versi aset tunggal, 1225 soal, 106/106 gambar render, 0 error JS.
- PERATURAN MUTU SOAL: 0 pelanggaran (10 butir) pada 1225 soal.
- UJI SEMUA FITUR: 52/52 lulus (lokal + CI).
- Uji runtime otomatis di Chromium (Playwright) LULUS: 9 kategori, tryout terkunci, simulasi format,
  hafalan, bank soal, 0 error JavaScript.
- Audit kunci gelombang kedua: 568 soal hafalan diperiksa ulang secara independen → 8 koreksi
  (termasuk 1 kunci yang benar-benar salah: w47).
- Ukuran buka pertama turun dari ~160 KB menjadi ~66-70 KB (gzip) setelah data dipecah per kategori.
- Uji browser di situs live: 1000 soal termuat, pembahasan tampil 3 baris, 41/41 gambar OK, 0 error JS.

### Tambahan v30 (13 September 2026)
- Tes kepribadian **Big Five dari Mini-IPIP (20 butir, domain publik)** + jalur **Umum / Dunia Kerja** untuk
  non-kedinasan (pencari kerja). Baterai kini 9 modul & 5 jalur.
- **Laporan Lengkap siap dijual** (belum dibuka): rencana Rp 39.000 **sekali bayar**, bukan langganan —
  alasan lengkapnya di LAPORAN-AUDIT.md bagian 11.
- Halaman arahan SEO: `psikotes/index.html` (judul 63 karakter, schema FAQ) dengan bahasa sederhana.
- Instrumen berlisensi (Raven/WAIS/CFIT/IST/PAPI/MMPI/Wartegg) **tidak** dipakai; IPIP dipakai karena
  domain publik. Batas jujur (belum ada norma lokal, bukan diagnosis) dinyatakan di dalam aplikasi.

### Tambahan v31
- Nama produk diganti **SiapSeleksi → SiapPsikotes** (subjudul "Latihan Tes IQ, Psikotes Kerja & Kepribadian")
  agar memuat kata kunci yang dicari orang ("psikotes") sehingga mudah ditemukan sekaligus mudah diingat;
  ikut diubah di `manifest.json`, meta deskripsi, og:title, JSON-LD, dan `psikotes/index.html`.
- Fitur baru **profil belajar tanpa akun** (`static/js/fitur9.js`): nama panggilan, tanggal ujian, dan fokus
  utama — aplikasi menyapa dengan nama, menghitung hari menuju ujian, dan menyusun "Fokus hari ini";
  tersimpan HANYA di perangkat (`localStorage` `tni_profil`), tanpa server/akun, bisa dihapus kapan saja.
- Keputusan **tidak memakai login untuk belajar**: login sebelum ada nilai membuat pengguna baru pergi
  sedangkan "tanpa akun" adalah keunggulan produk; akun hanya diperlukan saat pembayaran, dan bentuk
  paling ringan yang direncanakan adalah kode akses tanpa kata sandi (kata sandi tidak disimpan).
- Perbaikan **service worker** (`sw.js`) yang membuat offline benar-benar jalan: nama cache diseragamkan
  (`'siap-psikotes-<stamp>'`) dan daftar berkas dibangun dari disk (14 dari 14 berkas JS terdaftar);
  dibuktikan uji offline sungguhan (1225 soal, fitur8 & fitur9 termuat, 0 error).

### Tambahan v33-v41 (sesi kerja malam 13 September 2026)
Ringkas: modul tes gambar (panduan + kanvas), persiapan wawancara, produk berbayar berwujud
(Laporan Lengkap + kode akses tanpa server), halaman publik mutu/syarat/privasi, pembersihan merek lama
di seluruh layar & berkas ekspor (+ gerbang anti-kambuh), perbaikan kontras WCAG AA 19->0 titik,
dan perbaikan penghambat publikasi (`.nojekyll` - dua build Pages gagal karena Jekyll).
Rincian lengkap: LAPORAN-AUDIT.md bagian 13. Hasil verifikasi: 102 uji aplikasi + 15 uji situs LIVE lulus.

## KOREKSI LABEL COMMIT (13 September 2026)

Commit `e136ef3` berlabel "feat(v32): logo baru (Psi) + ikon PWA" sebenarnya **berisi pekerjaan v33**:
`static/js/fitur10.js` (halaman panduan & latihan tes gambar), tambahan CSS-nya, dan bagian uji W.
Penyebabnya: skrip `tools/kirim.sh` masih menunjuk berkas pesan commit v32 (sekarang skrip menerima
berkas pesan sebagai argumen, jadi tidak terulang). Riwayat tidak ditulis ulang - pengiriman paksa
tidak dilakukan - dan koreksi ini menjadi catatan resminya.

## PENGAMAN PENGIRIMAN (WAJIB — baca sebelum push)

Sebelum setiap pengiriman, jalankan gerbang pemeriksaan yang sama dengan CI:

```bash
bash tools/periksa-sebelum-kirim.sh
```

Isinya: PERATURAN MUTU SOAL (11 butir) · VERIFIKASI BANK SOAL (termasuk **konsistensi versi aset**) ·
pemeriksaan sintaks seluruh JavaScript. Kalau ada satu gagal, pengiriman dibatalkan.

Agar tidak bisa terlewat, pasang sebagai hook git (sekali per clone):

```bash
python3 tools/pasang-hook.py
```

### Aturan saat menambah berkas aset baru

Tulis penanda versinya SAMA dengan berkas lain (lihat nilai `?v=` yang sedang dipakai), atau jalankan
`python3 tools/stamp-versi.py <stamp-terbaru>` sebelum commit. Versi aset yang tidak seragam adalah
penyebab CI merah yang paling sering terjadi — gerbang di atas menangkapnya sebelum terkirim.

### Pelajaran yang melahirkan pengaman ini

Dua kali CI merah ("Verifikasi Bank Soal") hanya karena pemeriksaan yang **sebenarnya tersedia lokal**:
pertama karena skrip pemeriksa membaca berkas kerja `.audit/` yang tidak ikut ke repo; kedua karena
berkas baru (`fitur7.js`) ditulis dengan `?v=1` sehingga konsistensi versi aset gagal. Keduanya bisa
dicegah mesin, dan sekarang memang dicegah.

## HALAMAN PUBLIK TERBACA TANPA JAVASCRIPT (22 September 2026)

Perayap yang tidak menjalankan skrip hanya melihat berkas HTML mentah. Karena itu seluruh
20 alamat publik diukur dalam keadaan skrip mati (`java_script_enabled=False`), lalu hasil
ukurnya dijadikan ambang di gerbang pemeriksaan supaya tidak bisa turun diam-diam.

| Halaman | Teks tanpa skrip | Ambang |
|---|---|---|
| `/contoh/` | 16.785 | 8.000 |
| 12 artikel `contoh-soal-*` | 7.158 - 19.992 | 5.000 |
| `/psikotes/` | 7.457 | 3.000 |
| `/privasi/` `/syarat/` | 7.667 / 7.274 | 3.000 |
| `/lisensi/` | 5.231 | 2.500 |
| `/mutu/` | 4.234 | 2.000 |
| `/beli/` | 2.788 | 1.500 |
| `/` (aplikasi) | 3.251 | 1.500 |
| `/404.html` | 1.223 | 600 |

Tidak ada halaman yang kembali menjadi kerangka: seluruh isi utama sudah ada di HTML, bukan
digambar skrip. Yang ditambahkan penjaganya, bukan perbaikannya. Beranda juga diuji harus
menautkan keduabelas artikel tanpa skrip, sebab tautan itulah satu-satunya jalan perayap
menemukan artikel-artikel tersebut. Gerbang: **206 lulus, 0 gagal** (sebelumnya 185).
Mode `--rusak` menangkap 40 kegagalan, jadi pemeriksaan ini benar-benar mengukur.

## GERBANG AKSES DIPINDAH KE SERVER (26 September 2026)

Sebelumnya kode akses diperiksa di perangkat pembeli: aplikasi menghitung sidik 4 huruf dari
kunci `siap|psikotes|2026|kode` yang **ikut terkirim ke peramban** (`static/js/fitur11.js`,
`tools/buat-kode.py`). Artinya siapa pun bisa membuat kode dengan sidik yang benar tanpa
membayar, lalu membuka seluruh aplikasi. Uang bisa masuk lewat `/beli/`, tetapi tidak ada
satu pun pemeriksaan di server yang bisa menahan orang yang tidak membayar.

Yang berubah:

| Bagian | Sebelum | Sesudah |
|---|---|---|
| `/api/ruang/masuk` | terima kode apa pun yang sidiknya cocok | hanya kode yang **terbit** di tabel `kode_terbit` dan tercatat lunas (lainnya 400) |
| `pembelian.nominal` | ditulis dari badan kiriman peramban | ditulis dari catatan setoran server (`kode_terbit`) |
| Penerbitan kode | `tools/buat-kode.py` (offline, siapa pun bisa) | `tools/terbitkan-kode.py` dan `POST /api/pemilik/kode-terbit` — keduanya wajib menyertakan rujukan + nominal setoran |
| Gerbang di peramban | kode lolos sidik = terbuka | putusan server dipakai lebih dulu; server tak terjangkau = pemeriksaan lokal (pembeli yang sudah membayar tidak dikunci gara-gara sinyal) |

Tabel `kode_terbit` menyimpan **hash** kode, bukan kodenya — sama seperti tabel `sesi`.

Bukti uji (Worker dijalankan lokal dengan D1 lokal, bukan pernyataan):

```
POST /api/ruang/masuk {"kode":"SPZZMUNGERTEST01PHCT"}   -> 400 {"pesan":"kode tidak terdaftar"}
POST /api/ruang/masuk {"kode":"SP260926E8962B1931AFVXW0"} -> 200 + token   (kode setoran SP-900)
POST /api/pembelian {"nominal":1000,"rujukan":"NGARANG-123"} -> /api/saya: nominal 39000, rujukan SP-900
POST /api/pemilik/kode-terbit {"rujukan":"SP-777","nominal":41444,"jumlah":2} -> 200, 2 kode
POST /api/pemilik/kode-terbit (bukan pemilik) -> 403 ; (nominal 0) -> 400
```

Catatan penting untuk pemilik: kode yang **sudah terlanjur dijual** sebelum perubahan ini tidak
ada di tabel, jadi ditolak. Daftarkan lewat
`python3 tools/terbitkan-kode.py --kode SP... --rujukan <nomor pesanan> --nominal 39000`.

Yang belum dibereskan (temuan, bukan bagian dari perubahan ini): kode pengembang
`SPDEVPEMILIKB01J4S1` masih tertulis di `static/js/akses.js` dan membuka aplikasi di perangkat
mana pun yang menempelkannya — sebaiknya dicabut atau dijadikan kata sandi yang tidak ikut ke repo.


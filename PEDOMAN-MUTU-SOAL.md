# PERATURAN MUTU SOAL — Platform Belajar PK Perwira TNI

Berlaku sejak: 12 September 2026 · Versi dokumen: 1.0
Situs: https://siappsikotes.my.id/

> **Prinsip dasar.** Ini **platform belajar**, bukan kumpulan soal biasa. Satu kunci yang salah,
> satu soal yang ambigu, atau satu pembahasan yang tidak bisa diikuti cara mengerjakannya bisa
> membuat pengguna belajar hal yang keliru. Karena itu setiap butir di bawah ini **wajib** —
> bukan anjuran — dan **diperiksa mesin** di setiap perubahan (`tools/peraturan-mutu.py`).
> Soal yang tidak lolos **tidak boleh naik ke situs**.

---

## A. Peraturan yang diperiksa mesin (11 butir)

| Kode | Peraturan | Cara diperiksa | Akibat bila dilanggar |
|------|-----------|----------------|------------------------|
| **P1** | Setiap soal wajib punya **label topik** | `tools/peraturan-mutu.py` | Build gagal |
| **P2** | Tidak boleh ada **dua opsi berteks sama** dalam satu soal | pemeriksa | Build gagal |
| **P3** | Dilarang opsi "semua benar"/"semua salah"/"semua di atas" (membuat soal ambigu) | pemeriksa | Build gagal |
| **P4** | **Kunci tidak boleh bocor di pertanyaan** (kecuali soal bacaan, soal bergambar, soal kalender, dan besaran yang memang diberikan di soal) | pemeriksa | Build gagal |
| **P5** | Kunci **tidak boleh selalu jadi opsi terpanjang** (maksimal 45% soal; sekarang 24%) | pemeriksa | Build gagal |
| **P6** | Setiap pembahasan wajib **≥ 3 baris**: `JAWABAN:` + cara/penjelasan + `INGAT:` | pemeriksa | Build gagal |
| **P7** | Soal hitung wajib memuat **langkah perhitungan eksplisit** (tanda `=`, `×`, `÷`, atau `√`) di pembahasan | pemeriksa | Build gagal |
| **P8** | **Sebaran posisi kunci merata**: tiap posisi A/B/C/D 20–30% (sekarang 25% masing-masing) | pemeriksa | Build gagal |
| **P9** | Soal bergambar yang jawabannya bisa dihitung **wajib diverifikasi otomatis dari gambarnya** (minimal 30 soal; sekarang 34) | pemeriksa | Build gagal |
| **P10** | Semua soal kategori Tes Gambar **wajib punya gambar** | pemeriksa | Build gagal |
| **P11** | **Tidak boleh ada AI online / API AI berbayar di dalam aplikasi.** AI hanya untuk mengajar, hanya berjalan di perangkat, nol biaya per pertanyaan | pemeriksa | Build gagal |

Pemeriksaan tambahan yang juga mengikat (dari `tools/verifikasi-soal.py`):
indeks kunci valid · tepat 4 opsi · tidak ada soal duplikat · hitung ulang aritmetika (126 soal) ·
aturan satuan Kraepelin (95 soal) · kunci soal kolom Kraepelin cocok dengan angka di gambarnya ·
kunci 19 soal Tes Gambar dihitung ulang dari gambar · semua gambar SVG valid · versi aset konsisten ·
pembahasan tidak terlalu pendek.

## B. Peraturan proses (cara menambah / mengubah soal)

| Kode | Peraturan |
|------|-----------|
| **B1** | Soal **hanya** boleh ditambahkan lewat alur: `.audit/extract.py` → `.audit/fix.py` → `tools/pecah-data.py` → `tools/verifikasi-soal.py` + `tools/peraturan-mutu.py`. |
| **B2** | **Dilarang mengedit langsung** file hasil generate: `data/soal-*.js`, `data/soal-index.js`, `data/soal-penuh.js`, `data/tips.js`. Sumber tunggalnya `data/soal.js` (ditulis oleh `fix.py`). |
| **B3** | **Kunci wajib berasal dari salah satu**: (a) perhitungan yang bisa diulang mesin, atau (b) sumber tepercaya yang bisa ditunjuk. Menyalin kunci "karena kelihatannya benar" dilarang. |
| **B4** | **Dua gelombang pemeriksaan** untuk soal hafalan (TWK, Bahasa Inggris, Verbal, Penalaran, Kepribadian): gelombang 1 memeriksa kunci yang ada; gelombang 2 **pemeriksa independen** menentukan jawabannya sendiri lebih dulu, baru dibandingkan. Temuan gelombang 2 diverifikasi ulang sebelum diubah. |
| **B5** | **Setiap figur yang menentukan jawaban wajib punya pemeriksa otomatis** yang menghitung ulang jawaban dari isi gambar (bukan dari catatan pembuatnya). |
| **B6** | **Pembahasan harus bisa diikuti**: sebutkan langkah, bukan hanya hasil. Contoh benar: `688 + 254 = 942, lalu 942 − 340 = 602`. Contoh salah: `602`. |
| **B7** | **Baris INGAT wajib** dibedakan antara kiat hafalan (tanggal, pasal, rumus, semboyan) dengan penjelasan biasa — jangan menulis ulang jawaban sebagai "kiat". |
| **B8** | Perubahan **data** wajib menaikkan **versi aset** (otomatis lewat `.github/workflows/versi.yml` dari hash commit). Dilarang mengubah data tanpa menaikkan versi. |
| **B9** | **Dilarang mengklaim "sudah diverifikasi" tanpa bukti** (keluaran pemeriksa atau catatan berkas). Bukti disimpan di `.audit/` dan ringkasannya di `LAPORAN-AUDIT.md`. |
| **B10** | Soal yang dicurigai pengguna (lewat tombol **Laporkan soal**) masuk daftar prioritas audit; bila terbukti salah, kunci diperbaiki + ditulis di laporan. |

## C. Aturan isi pembahasan (cara mengerjakan)

Format tetap, tiga baris, dipisah baris baru:

```
JAWABAN: <kunci>
<cara mengerjakan langkah demi langkah, atau penjelasan konsep>
INGAT: <kiat hafalan / rumus cepat>
```

- **Hitungan**: tulis operasi dan hasil antara (`35% × 240 = 84; 240 − 84 = 156`).
- **Hafalan (TWK/sejarah/pasal)**: tulis fakta + pembeda dari opsi lain yang mirip.
- **Bahasa Inggris**: sebut aturan gramatikalnya (mis. "conditional type 3: if + had + V3").
- **Tes gambar**: jelaskan cara menghitung sistematis (dari bentuk terkecil ke terbesar).
- **Kepribadian**: jelaskan prinsip TNI-nya (proaktif, sopan, integritas, lewat prosedur).
- **Klarifikasi ambiguitas**: bila dua opsi bisa dibenarkan, soal itu **wajib diperbaiki** —
  bukan dijelaskan di pembahasan.

## D. Yang dilarang secara eksplisit

1. Menambah soal tanpa melewati pemeriksa.
2. Mengubah kunci tanpa sumber atau perhitungan ulang.
3. Membiarkan soal ambigu (dua jawaban benar) meski ada pembahasan "penjelasan".
4. Membiarkan soal bergambar yang jawabannya tidak bisa dicocokkan dengan gambarnya.
5. Menyalin kunci ke posisi yang sama terus-menerus (menumpuk di satu huruf).
6. Menulis pembahasan yang hanya mengulang kunci tanpa langkah mengerjakan.
7. Mengedit file hasil generate secara manual.
8. Menyatakan selesai sebelum pemeriksa lulus di CI.

## E. Cara menjalankan pemeriksaan (untuk siapa pun yang melanjutkan proyek ini)

```bash
/usr/bin/python3 .audit/extract.py          # 1. ekstrak dari data/soal.js
/usr/bin/python3 .audit/fix.py              # 2. terapkan koreksi + pembahasan + pecah per kategori
/usr/bin/python3 tools/peraturan-mutu.py    # 3. periksa 11 butir peraturan  (WAJIB lulus)
/usr/bin/python3 tools/verifikasi-soal.py   # 4. periksa akurasi & konsistensi (WAJIB lulus)
/usr/bin/python3 tools/uji-runtime.py       # 5. uji aplikasi di Chromium
```

CI menjalankan langkah 3-5 otomatis pada setiap push, dan **mingguan** (`.github/workflows/terjadwal.yml`)
termasuk smoke test situs yang tayang. Tidak ada pemeriksaan yang boleh dilewati.

## F. Ringkasan keadaan saat ini (15 Oktober 2026)

- 1.348 soal, 9 kategori, semuanya punya label topik, semua kunci valid, tidak ada duplikat.
- Posisi kunci: A 340 · B 340 · C 331 · D 337 (masing-masing ~25%, rasio kunci terpanjang 24%).
- 106 gambar soal; 80 di antaranya jawabannya dihitung ulang otomatis dari gambarnya.
- 38 soal punya gambar penjelasan bernomor; 1.348 pembahasan berformat JAWABAN/cara/INGAT.
- Semua 11 butir peraturan P1-P11 lulus; verifikasi-soal.py LULUS semua; uji runtime lulus; aksesibilitas axe tanpa pelanggaran;
  smoke test situs tayang SEHAT.

## G. Tambahan 13 September 2026 — aturan P11 (kebijakan AI)

Keputusan pemilik produk: **AI di aplikasi ini hanya untuk mengajar, hanya berjalan di perangkat pengguna,
dan tidak boleh ada AI online/API berbayar** (nol biaya per pertanyaan, tanpa akun, tanpa data keluar).

Konsekuensinya, tiga hal menjadi aturan yang diperiksa mesin:

1. **P11** menolak build bila ada alamat AI online di dalam kode aplikasi (static/js, data, index.html, sw.js).
2. AI hanya boleh bekerja di atas **materi yang sudah lulus peraturan mutu** — ia dilarang menyusun fakta baru.
   Kalau jawabannya tidak ada di materi, ia harus menyatakan tidak ada, bukan mengarang.
3. Soal baru yang lahir dari bantuan AI **wajib melewati 11 peraturan ini** sebelum dipakai, sama seperti soal
   yang ditulis manusia.

Yang sudah berjalan tanpa unduhan apa pun: **Tutor Lapisan 0** — menjelaskan inti cara mengerjakan, kiat ingat,
pembeda tiap opsi, dan mengarahkan ke soal teraudit lain pada topik yang sama. Seluruh isinya diambil dari
pembahasan yang sudah diaudit, jadi akurasinya sama dengan bank soalnya.

---

## H. Set Soal Batch 2 — bank kedua di luar alur pecah-data (23 Oktober 2026)

Butir 5 SPEC-RETENSI-30-HARI menambahkan bank kedua: `data/soal-batch2.js` — 120 soal varian baru
(awalan id b2w/b2m/b2e/b2l/b2n/b2v/b2k/b2kp), 8 modul × 15 soal, seluruhnya satu kategori bernama
"Set Soal Batch 2". Catatan untuk siapa pun yang melanjutkan:

1. Berkas ini **bukan hasil generate** `pecah-data.py`; ia sumber tunggalnya sendiri. Aturan B2
   ("dilarang mengedit file hasil generate") tidak membatasinya, tetapi ia tetap diperiksa mesin:
   `tools/peraturan-mutu.py` membacanya dan menjalankan **aturan yang sama persis** — P1 topik,
   P2/P3 opsi, P4 kunci tidak bocor, P5 kunci terpanjang, P6 isi pembahasan, P7 langkah hitung,
   P8 sebaran posisi kunci (30/30/30/30) — ditambah cek **duplikat konten** dan **id** dengan
   bank utama, dan kewajaran jumlah soal **merata antar modul** (15 per modul).
2. Tiap soal membawa field `modul` (tkw/matematika/bahasa_inggris/penalaran_logika/numerik/verbal/
   kraepelin/kepribadian) itu yang menjadikan aturan P7 tetap tegas pada soal hitung.
3. Kategori ini **tidak terdaftar** di `data/soal-index.js`. Ia hanya tampil setelah
   `GET /api/batch2/status?kode=...` membalas `{ batch2: true }` (baris kode_terbit nominal 29.xxx,
   asal tripay/klaim/alat-pemilik). Alurnya di `static/js/batch2.js`: kode disimpan di
   localStorage `tni_batch2`, konten (`data/soal-batch2.js`) baru diunduh setelah izin, dan tanpa
   izin tidak ada apa pun yang terlihat di aplikasi. `data/soal-batch2.js` sengaja **tidak** masuk
   daftar precache `sw.js` supaya tidak diunduh untuk semua pengunjung.

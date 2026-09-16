# Rencana Variasi & Keseimbangan Bank Soal

Catatan kerja — dasar pengambilan keputusan, bukan bahan promosi.
Ditulis 16 Sep 2026, sesudah keluhan pemilik: *"soal yang di-drill rata-rata hanya
diulang, jadi kalau saya hafal soalnya sama saja."*

---

## 1. Kenapa keluhan itu benar (diukur, bukan dikira)

**A. Bank kategori (1225 soal) — drill 25 soal acak per sesi, tanpa riwayat.**

| kategori | bank | sesi 2 | sesi 4 | sesi 6 | soal yang sudah pernah keluar |
|---|---|---|---|---|---|
| tes_gambar | 80 | 7 | 17 | 24 | 96% pada sesi 6 |
| bahasa_inggris | 130 | 5 | 14 | 16 | 64% pada sesi 6 |
| kepribadian | 113 | 5 | 15 | 17 | 68% pada sesi 6 |
| verbal | 100 | 6 | 12 | 19 | 76% pada sesi 6 |
| tkw | 203 | 4 | 8 | 11 | 44% pada sesi 6 |

Sebabnya satu baris kode: `S.questions = shuffle(bank)` lalu `slice(0, 25)`.
Pengacakan tanpa riwayat = pengulangan yang tak terhindarkan dan cepat dihafal.

**B. IQ Lab (soal dibuat mesin) — jauh lebih parah.**

| domain | pola berbeda dalam 1 set 10 soal (dulu) | soal persis sama yang muncul lagi |
|---|---|---|
| Deret Huruf | 2,96 dari 10 — satu pola bisa muncul 8x | 8,5% |
| Matriks Figural | 3,81 dari 10 | **69,5%** |
| Campuran | — | 4 dari 5 soal jenis yang sama bisa kembar |

100% set drill mengandung pola kembar. Jadi siswa memang menghafal bentuk soal,
bukan melatih penalaran.

---

## 2. Yang sudah dikerjakan (16 Sep 2026)

### 2a. Mesin soal ber-riwayat — `static/js/mesin-soal.js` (berkas baru)

- Tiap soal diberi **sidik tetap** (`kunciSoal`) dari isinya. Bank lama tidak punya
  field `id`, jadi sidik dibuat dari teks — tetap stabil antar sesi.
- Hasil tiap soal dicatat: benar/salah, kapan terakhir, berapa kali beruntun benar
  (`tni_soal_riwayat`, ikut Export/Import dan sinkronisasi Google Drive).
- `pilihSoalAdaptif(bank, n)` mengurutkan soal dengan prioritas:
  1. belum pernah keluar (100) → 2. pernah salah & belum tuntas (90) →
  3. pernah tampil tapi belum dikerjakan (82) → 4. sudah benar sekali (45+, makin
  lama makin naik) → 5. sudah benardan kokoh (10+, jarak hari menaikkan).
- Dipakai mode **Belajar** dan **Drill 25**. Mode **Tryout tetap acak murni**
  supaya hasil ujinya jujur seperti ujian asli.

Bukti (uji 8 sesi, bank 130 & 80 soal):

```
                       sesi1 sesi2 sesi3 sesi4 sesi5 sesi6 sesi7 sesi8
cara lama · bank 130     0     5    10    14    12    16    16    20
cara baru · bank 130     0     0     0     0     0    20    25    25   <- ulangan baru mulai sesi 6, setelah bank HABIS
cara lama · bank  80     0     7    12    17    23    24    20    23
cara baru · bank  80     0     0     0    20    25    25    25    25
```

Artinya: bank 100-200 soal kini benar-benar dipakai sampai habis dulu (3-5 sesi),
dan yang diulang adalah soal yang **belum bisa** — bukan acak.

### 2b. Generator IQ diperluas — `data/soal-iq.js`

| domain | pola lama | pola sekarang |
|---|---|---|
| Deret Angka | 8 | **20** |
| Deret Huruf | 3 | **11** |
| Matriks Figural | 4 aturan | **10 aturan** |
| Rotasi Figural | 1 bentuk | **8 bentuk × 4 orientasi × 7 sudut** |
| Verbal & Aritmetika | 6 | **14** |

Ditambah tiga pagar mutu:

1. **Satu pola maksimal 2x per set** (dulu sampai 8x).
2. **Penjaga ambiguitas**: setiap soal deret dihitung ulang memakai SEMUA pola yang
   mungkin cocok; kalau ada pola lain yang menghasilkan jawaban berbeda, soal itu
   dibuang (dulu ada soal yang bisa dijawab 48 atau 84 — dua-duanya "benar").
3. **Riwayat lintas sesi**: soal yang pernah keluar diturunkan prioritasnya.

Hasil ukur sesudah perbaikan (300 sesi):

| domain | pola berbeda per set 10 soal | set yang punya pola muncul 3x+ | ulangan dalam 12 sesi berturut |
|---|---|---|---|
| Deret Angka | 8,50 dari 10 | 0% | 0 dari 10 tiap sesi |
| Deret Huruf | 7,30 dari 10 | 0% | 0 dari 10 tiap sesi |
| Matriks Figural | 6,59 dari 10 | 0% | 0-3 dari 10 |
| Rotasi Figural | 6,54 dari 10 | 41% (3 bentuk sekali) | 0 dari 10 tiap sesi |
| Verbal | 8,21 dari 10 | 0% | 0 dari 10 tiap sesi |

Bug nyata yang ditemukan alat verifikasi dan sudah diperbaiki: **domain "Putar vs
Cermin" menghasilkan 0 soal** (`innerBentuk` tidak diekspor) — drill-nya kosong dan
tak ada uji yang menangkapnya. Sejak itu uji fitur menuntut **setiap** domain
menghasilkan 10 soal, bukan hanya "ada minimal 5 soal".

### 2c. Perkakas baru (bisa dijalankan ulang, ini buktinya)

```bash
node tools/verifikasi-iq.cjs        # 4000 soal: hitung ulang kunci dari teks soal
                                    # hasil: 0 kunci salah, 0 soal ambigu,
                                    #        ~4,8% tak dapat diverifikasi mesin (pola prima dll — wajar)
node tools/periksa-variasi-iq.cjs   # keragaman pola & ulangan antar sesi
```

Seluruh soal IQ juga tetap tidak dikirim ke jaringan (P11) dan tetap dibuat di
perangkat pengguna.

### 2d. Beban muat pertama

Karena `data/soal-iq.js` tumbuh 25 → 51 KB, berkas itu **tidak lagi dimuat di awal**
(dulu ikut beban muat pertama). Sekarang diunduh saat halaman IQ dibuka
(`pastikanIQ()` di `data-loader.js`). Beban muat pertama turun dari 448 KB ke
±423 KB dari anggaran 450 KB — halaman utama jadi lebih ringan, dan generator IQ
bebas diperluas tanpa melanggar anggaran.

---

## 3. Pekerjaan berikutnya: menyeimbangkan 1225 soal

Jumlah sekarang tidak seimbang: kategori paling tebal 2,5x kategori tertipis.

| kategori | sekarang | usul target | tindakan |
|---|---|---|---|
| tkw | 203 | 150 | pangkas soal lemah/duplikat |
| numerik | 184 | 155 | pangkas soal lemah/duplikat |
| matematika | 166 | 150 | pangkas tipis |
| penalaran_logika | 134 | 145 | tambah 11 |
| kepribadian | 113 | 135 | tambah 22 |
| kraepelin | 115 | 130 | tambah 15 |
| bahasa_inggris | 130 | 135 | tambah 5 |
| verbal | 100 | 140 | tambah 40 |
| tes_gambar | 80 | 140 | tambah 60 |
| **total** | **1225** | **1280** | ± 5% dari 1225 |

Aturan wajib saat mengerjakan (dari `PEDOMAN-MUTU-SOAL.md`, jangan dilanggar):

1. Kunci hanya dari perhitungan yang bisa diulang mesin atau sumber yang bisa
   ditunjuk — dilarang menebak.
2. Setiap soal bergambar butuh pemeriksa otomatis yang menghitung ulang jawaban
   dari isi gambarnya (`tools/verifikasi-gambar.py`).
3. Sebelum menambah, jalankan `tools/peraturan-mutu.py` dan sesudahnya juga.
4. Soal baru diuji dalam mode yang seharusnya GAGAL dulu, supaya ketahuan ujinya
   benar-benar mengukur.

Urutan yang saya sarankan: **tes_gambar → verbal → kepribadian → kraepelin**
(kategori tertipis dan paling sering dipakai latihan kognitif), baru pemangkasan
tkw/numerik yang butuh audit satu per satu.

---

## 3b. Progres nyata (16 Sep 2026, lanjutan)

**Tes Gambar & Visual: 80 → 141 soal.** 61 soal baru dibuat dengan
`tools/buat-soal-gambar.py` (delapan jenis: deret titik, hitung bentuk,
jumlah sisi bangun, jumlah sel kisi, titik sudut bertanda, garis diagonal,
warna kotak ke-n, sudut jarum jam). Setiap soal menyimpan field `verifikasi`
yang hanya menyatakan ATURAN polanya; kuncinya dihitung ulang dari isi SVG oleh
`tools/verifikasi-gambar.py` (pemeriksa generik baru).

Bukti yang sudah dijalankan:

```
tools/verifikasi-soal.py  -> kunci Tes Gambar cocok dengan isi gambarnya (80 soal diperiksa otomatis)
                             (sebelumnya 19; pagar P9 menuntut minimal 30)
uji rusak (kunci digeser) -> 8 dari 8 jenis pemeriksa MENDETEKSI kesalahan
uji peramban              -> 61 gambar baru semuanya ter-decode, tampil 4 opsi, pembahasan terbuka, 0 galat JS
tools/peraturan-mutu.py   -> SEMUA PERATURAN DIPATUHI (total bank 1286 soal)
```

Sisa kategori masih dikerjakan: **verbal (100 → 140)** dan
**kepribadian (113 → 135)**. Soal dua kategori ini bersifat hafalan/situasional,
jadi wajib melalui dua gelombang pemeriksaan (pemeriksa kedua menentukan
jawabannya sendiri lebih dulu) sebelum masuk bank.

### 3c. Progres lanjutan — ketiga kategori selesai (total bank 1.348 soal)

| kategori | sebelum | sesudah | cara | pemeriksaan |
|---|---|---|---|---|
| Tes Gambar & Visual | 80 | **141** | generator 8 jenis, kunci dihitung dari gambar | 80 soal terverifikasi mesin (dulu 19) |
| Kemampuan Verbal | 100 | **140** | 40 soal baru (analogi, sinonim, antonim, hubungan kata, baku, kalimat efektif, bacaan, idiom) | gelombang 2: 39/40 sepakat; sisa 1 soal sudah diganti di versi baru |
| Tes Kepribadian Situasional | 113 | **135** | 22 soal situasional berbasis rubrik | gelombang 2: 22/22 sepakat |

Hasil pemeriksaan gelombang kedua (pemeriksa independen menjawab tanpa melihat kunci):

```
verbal       39 dari 40 sama dengan kunci tertulis (yang berbeda adalah soal yang
             memang sudah diganti sesudah pemeriksa membacanya)
kepribadian  22 dari 22 sama dengan kunci tertulis
```

Temuan yang langsung ditindaklanjuti dari pemeriksaan itu:

- **4 soal verbal ditandai berpotensi ambigu** (PETANI:SAWAH dengan pengecoh alat,
  antonim TERSURAT, soal kelompok alat kerja, penulisan "karisma") — tiga di antaranya
  saya tulis ulang agar pengecohnya tidak lagi bisa dibela, satu (karisma) memang sudah
  baku menurut KBBI sehingga dibiarkan.
- **1 soal kepribadian pengecohnya kembar** dengan opsi lain sehingga distraktornya
  hilang — sudah diganti dengan opsi yang berbeda tajam.
- **1 soal analogi pengganti saya sendiri bertabrakan dengan soal lama** ("GURU : MURID
  = PELATIH"), ketahuan oleh pemeriksa duplikasi otomatis, lalu diganti lagi. Pelajaran:
  setiap kali mengganti soal, jalankan pemeriksa duplikasi terhadap seluruh bank — bukan
  hanya terhadap soal baru.

Perkakas baru: `tools/buat-soal-gambar.py` (pembuat soal bergambar),
`tools/sisip-soal-baru.py` (penyisip draf ke bank + pemicu pecah-data),
pemeriksa generik di `tools/verifikasi-gambar.py`, dan pemeriksa duplikasi.

---

## 4. Pekerjaan berikutnya: supaya latihan benar-benar mengukur, bukan hafalan

1. **Kesulitan berjenjang + mode adaptif.** Soal diberi tingkat 1-3; jawaban benar
   menaikkan tingkat, salah menurunkan. Ini yang membedakan "latihan" dari
   "menghafal jawaban" — dan hanya cara ini yang memberi sinyal kemampuan.
2. **Timer per soal** (sudah ada `catatWaktuSoal`) dipakai untuk laporan kecepatan
   per jenis soal, karena kecepatan pemrosesan adalah komponen yang paling bisa
   dilatih.
3. **Laporan diagnostik per domain** di halaman Progress: akurasi, rata-rata waktu,
   dan daftar 10 soal yang paling sering salah — bukan sekadar "nilai 80".
4. **Kalimat jujur yang harus dipertahankan**: angka di IQ Lab adalah akurasi
   latihan, bukan IQ. Skor IQ hanya dari alat ukur tervalidasi (ICAR, Mensa,
   TIKI) yang dicatat manual di tab Log Skor. Jangan pernah menulis sebaliknya.

---

## 5. Cara memeriksa sendiri (tanpa saya)

```bash
cd ~/tni-belajar
node tools/periksa-variasi-iq.cjs    # lihat sendiri: keragaman & ulangan
node tools/verifikasi-iq.cjs         # lihat sendiri: kunci salah = 0?
bash tools/periksa-sebelum-kirim.sh  # gerbang lengkap sebelum kirim (log: /tmp/gate-kirim.log)
```

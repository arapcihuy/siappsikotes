# Riset Akuisisi Pembeli Psikotes TNI Rp 39.000
Task: `t_91d246bd` · 23 Oktober 2026 · research-thompson / operator

## 0. PENTING — riset ini duplikat, dan datanya sudah dikonsolidasikan

Spesifikasi `t_91d246bd` **identik** dengan dua task yang sudah selesai:
- `t_a4a3a26f` (17 Okt) — "Riset akuisisi pembeli psikotes TNI Rp 39.000: kanal komunitas, kata kunci pencarian, harga pesaing"
- `t_f6cad6b4` (16 Okt) — judul sama

Heartbeat membuat versi ketiga tanpa memeriksa arsip. Artefak lama masih utuh dan isinya bagus, jadi laporan ini **menggabungkan** data lama (terverifikasi URL) dengan data baru, bukan mengulang dari nol.

Data mentah baru (23 Okt): 14 SERP query, 10 seed Google Autocomplete, 7 aplikasi Play Store, 7 channel Telegram, 6 query YouTube.

---

## 1. Kata kunci — 152 keyword nyata dari Google Autocomplete

Berkas: `keyword_autocomplete.csv` (152 baris, sumber `google_autocomplete_2026-10-23`)

Beda penting dari riset sebelumnya: riset lama memakai **estimasi volume** (`volume_bulanan_id_est: 8800`) yang tidak bisa dibuktikan. Data baru ini **kata kunci yang benar-benar disarankan Google** — bukti ada orang mengetiknya.

### Celah terbesar: 18 keyword tanpa halaman padanan

Dari 152 keyword, **18 tidak punya halaman** di siappsikotes.my.id, dan semuanya mengerucut ke dua topik:

| Klaster | Jumlah keyword | Halaman kita sekarang |
|---|---|---|
| **Tes Wartegg** | 9 | **TIDAK ADA** |
| **Tes Kraepelin** | 9 | ada `/contoh-soal-tes-kraepelin/` tapi **0 kemunculan kata "wartegg"** dan tidak menyasar frasa panjangnya |

Contoh keyword Wartegg yang belum dilayani:
`tes wartegg`, `tes wartegg pdf`, `tes wartegg online`, `tes wartegg 8 kotak`, `tes wartegg adalah`, `tes wartegg dan penjelasannya`, `tes wartegg 12 kotak`, `tes wartegg 8 kotak pdf`, `tes wartegg berapa menit`

Contoh keyword Kraepelin yang belum dilayani:
`tes kraepelin dan pauli`, `tes kraepelin pdf`, `tes kraepelin berapa menit`, `tes kraepelin print`, `tes kraepelin pdf gratis`, `tes kraepelin dari atas atau bawah`, `tes kraepelin biasanya berapa detik`, `tes kraepelin untuk apa`, `tes kraepelin adalah`

**Insight 1:** Ini peluang paling murah yang ada. Dua halaman saja (Wartegg + Kraepelin long-tail) menutup **18 dari 18** celah keyword. Keduanya topik yang sudah ada di bank soal kita, jadi tidak perlu riset konten baru — tinggal menulis halaman.

**Insight 2:** Kata "pdf" muncul 4x di keyword. Artinya segmen ini mencari **berkas yang bisa dicetak/dibaca offline** — persis keunggulan yang sudah kita klaim ("bisa offline setelah load"). Ini sudut copy yang belum dipakai.

**Insight 3:** Pertanyaan "berapa menit / berapa detik / dari atas atau bawah" menunjukkan pencari **belum tahu aturan main tesnya**, bukan mencari soal. Konten jenis ini menangkap trafik sebelum orang membeli apa pun — tempat terbaik menaruh CTA.

---

## 2. SERP — siapa yang menguasai halaman 1

Berkas: `serp_kompetitor.csv` (84 baris, 14 query × 6 hasil)

Dominasi domain dari 84 hasil:

| Domain | Kemunculan | Jenis |
|---|---|---|
| id.scribd.com | 10 | dokumen unggahan pengguna |
| app.jadiprajurit.id | 6 | aplikasi tryout |
| tryout.one | 6 | aplikasi tryout |
| jadiprajurit.id | 5 | platform tryout |
| casis.or.id | 5 | komunitas casis |
| dealls.com | 4 | portal karier |
| latihancat.com | 3 | tryout TNI |
| gramedia.com | 3 | toko buku |

Query yang halaman 1-nya **didominasi dokumen/agregator** (paling mudah direbut dengan artikel bagus): `soal psikotes bintara` (4 dari 6), `buku soal psikotes TNI` (3), `soal psikotes polri 2026` (3), `soal psikotes TNI` (2), `contoh soal psikotes TNI dan jawabannya` (2), `beli soal psikotes TNI` (2).

**Insight 4:** `id.scribd.com` muncul 10 kali — dokumen PDF unggahan orang, tanpa situs yang dioptimasi. Ini pesaing terlemah yang bisa dikalahkan dengan satu halaman yang lebih rapi dan cepat.

---

## 3. Harga pesaing — posisi Rp 39.000

Berkas: `harga_pesaing_gabungan.csv` (22 baris: 15 dari riset lama + 7 aplikasi Play Store baru)

### Aplikasi B2C di Google Play (data baru, 23 Okt)

| Aplikasi | Rating | Unduhan | Rentang harga IAP |
|---|---|---|---|
| Tes Koran Kraepelin | 4,8 | 50 rb+ | Rp 14.150 – Rp 659.000 |
| Tes Kraepelin: Pauli Psikotes | 4,7 | 10 rb+ | Rp 10.000 – Rp 399.000 |
| Tes IQ dan Psikotes | 4,4 | 100 rb+ | Rp 10.000 – Rp 309.000 |
| Tryout Psikotes | 4,3 | 50 rb+ | Rp 4.000 – Rp 25.000 |
| Psikotes Daring | 4,2 | 5 rb+ | (tanpa IAP) |
| Booster Psikotes | 3,9 | 10 rb+ | (tanpa IAP) |
| Simulasi Psikotes Kerja | 3,7 | 10 rb+ | Rp 10.000 – Rp 309.000 |

### Pesaing web (riset lama, URL terverifikasi)

`LatihanCAT.Com` Rp 70.000/tahun · `TesKoran.id` Rp 49.000 sekali bayar · `ASN Institute` Rp 299.000–349.000 paket · plus 11 vendor korporat B2B (Rp 45.000–2.690.000).

### Posisi kita

- 24 titik harga terkumpul: **median Rp 55.000**, min Rp 4.000, max Rp 2.690.000
- 11 titik harga **di bawah** Rp 39.000, 13 **di atas**
- Rp 39.000 berada di **kuartil bawah** — lebih murah dari LatihanCAT (70rb) dan TesKoran (49rb) untuk produk sejenis

**Insight 5:** Yang menjual lebih murah dari kita (`Tryout Psikotes` Rp 4.000–25.000) memakai model **IAP bertingkat** — murah di depan, mahal di paket lengkap. Yang lebih mahal (`LatihanCAT` 70rb, `TesKoran` 49rb) justru **sekali bayar seperti kita**. Artinya Rp 39.000 sudah tepat: lebih murah dari pesaing langsung, dan tidak terlihat "murahan" karena bukan model potong-potong.

---

## 4. Komunitas — ukuran nyata, bukan klaim

Berkas: `komunitas_telegram.csv` (13 baris, dari `t.me/s/<channel>`)

| Channel | Subscriber | Status |
|---|---|---|
| `soalpsikotestid` | **5.796** | aktif, 3 post terlihat |
| `casismiliter` | **1.318** | aktif (sudah ada di riset lama) |
| `komunitascasis` | 29 | kecil |
| `bidiktnipolri` | 7 | kecil |
| `casis_tni_ad_au_al` | 3 | kosong |
| 8 lainnya | — | tidak menampilkan angka (privat/diblokir) |

Kanal yang **diblokir** saat riset: `disboard` (403), `biggo` (DNS gagal), `shopee` SERP (lewat mesin pencari, bukan langsung).

**Insight 6:** Hanya **2 channel** yang benar-benar layak: `soalpsikotestid` (5,8 rb) dan `casismiliter` (1,3 rb). Sisanya di bawah 30 anggota — tidak sepadan waktunya. Dan keduanya butuh **admin menambahkan bot** dulu (masalah yang sama seperti `t_373a4590`).

---

## 5. Permintaan di YouTube — bukti orang benar-benar mencari

Berkas: `youtube_demand.csv` (48 baris, 6 query)

Video dengan penonton tertinggi per topik:

| Topik | Video teratas | Views |
|---|---|---|
| Tes Wartegg | "Correct Wartegg Test Image To Pass" | **250.329** |
| Soal psikotes Polri | video 2025 | 184.096 |
| Psikotes TNI | video 2025 | 182.825 |
| Tes Kraepelin | "Tes Wartegg" (judul tertukar di sumber) | 10.524 |

**Insight 7:** Wartegg menang telak — **250 ribu penonton** pada satu video, lebih tinggi dari psikotes TNI umumnya. Ini memperkuat celah keyword di bagian 1: permintaan Wartegg besar, dan kita **tidak punya halamannya sama sekali**.

---

## 6. Tiga aksi berurutan (semuanya nol modal)

1. **Tulis halaman `/tes-wartegg/`** — menutup 9 keyword, topik dengan permintaan YouTube tertinggi (250 rb views). Sudah ada soalnya di bank, tinggal halaman + contoh visual.
2. **Perluas `/contoh-soal-tes-kraepelin/`** — tambah frasa panjang ("berapa menit", "dari atas atau bawah", "dan pauli", "pdf"). Menutup 9 keyword lain tanpa halaman baru.
3. **Satu halaman perbandingan harga** — 22 titik harga sudah terkumpul; posisi Rp 39.000 di kuartil bawah pesaing langsung adalah argumen jual yang jujur dan bisa dibuktikan.

Yang **jangan** dikerjakan dulu: broadcast. Tidak ada daftar siap-kirim (leads_v4 isinya alamat pesaing, leads_v5 hanya bisa dibalas lewat komentar YouTube), dan Tripay masih 503.

---

## 7. Keterbatasan data (jujur)

- **Volume pencarian tidak diukur.** Yang ada hanya saran autocomplete (bukti ada yang mengetik) dan views YouTube. Tidak ada angka volume bulanan — riset lama memakai estimasi yang tidak bisa dibuktikan, sengaja tidak saya ulang.
- **SERP diambil 6 hasil per query**, bukan 10, dan bisa dipengaruhi lokasi/perangkat.
- **Harga Shopee/Tokopedia tidak diambil langsung** (diblokir); yang ada hanya judul hasil dari mesin pencari.
- **`disboard`, `biggo`, `shopee` langsung: diblokir** (403 / DNS gagal). Tidak ada angka dari sana.
- **8 dari 13 channel Telegram** tidak menampilkan jumlah anggota (privat) — tidak bisa dipakai sebagai bukti ukuran.

# Rencana Traffic Mingguan SiapPsikotes — 3 Frasa Terpilih + 10 Kanal Organik yang Membuka

Tanggal: 19 Okt 2026 (Senin) · Peneliti: Thompson, Head of Market Intelligence · Untuk dieksekusi oleh: marketing-godin
Basis data: audit t_cd642aa0 (6 kunjungan unik /beli/ per 30 hari, 0 bayar), CSV ekspor funnel 12–19 Okt 2026, CSV kanal_akuisisi_psikotes (t_dd3e758a), verifikasi langsung hari ini (autocomplete Google+Bing, status HTTP, timestamp posting). Zero biaya — semua verifikasi via endpoint publik gratis.

## Kesimpulan dulu

1. **Reddit dan Quora gugur terbukti** — keduanya memblokir akses dari jaringan ini (403/challenge, bukti terlampir). Kaskus dan Telegram terbuka penuh; keduanya jadi tulang punggung kanal organik minggu ini.
2. **Verifikasi ulang mengubah prioritas kanal**: tiga grup Telegram dari CSV kanal lama ternyata dorman (post terakhir 2022, 2023, Agu 2025 — timestamp di bawah). Pengganti yang aktif terverifikasi: grup CPNS 1.737 online saat dicek, grup openkerja posting 1 Okt 2026, Kaskus FORMIL reply 24 Sep 2026.
3. **3 frasa terpilih** dari 14 frasa diverifikasi autocomplete Google+Bing: `psikotes tni ad bintara`, `contoh soal psikotes tni dan jawaban(ja)`, `latihan psikotes tni online gratis`. Frasa "pagu gaji tni" gugur: nol saran di Google (tidak ada demand pencarian).
4. **Proyeksi realistis minggu pertama: 390–1.962 kunjungan** (vs baseline 1,4/minggu) bila 10 kanal dieksekusi dengan ritme anti-spam — dengan disclaimer jujur di bagian 4, karena belum ada satu pun posting historis dan CTR dalam-funnel 10% berasal dari trafik test.

---

## 1. Verifikasi 14 frasa → pilih 3 (bukti: `bukti_autocomplete_raw.json`, `bukti_ekspansi.json`)

Metode: endpoint autocomplete publik Google (`suggestqueries.google.com`, hl=id) + Bing (`osjson.aspx`) — gratis, tanpa API key. Autocomplete hanya mengeluarkan saran untuk frasa yang benar-benar diketik orang, jadi "muncul" = demand nyata.

| # | Frasa | Google | Bing | Keputusan |
|---|---|---|---|---|
| 1 | psikotes tni | 8 saran (ad, au, al, polri, ad bintara, 2026) | 8 saran | induk cluster |
| 2 | psikotes tni bintara | 8 saran (per matang: ad/al/au) | 2 saran | **PILIH (A)** |
| 3 | psikotes polri | 8 saran (2026, online, pdf, angka hilang) | 8 saran | cadangan (produk fokus TNI) |
| 4 | psikotes tni al | 8 saran (bintara, pdf, 2026) | 6 saran | cadangan |
| 5 | psikotes tni ad | 8 saran (bintara, tamtama, 2026, pdf) | 8 saran | masuk artikel A |
| 6 | contoh soal psikotes tni | 8 saran (ad dan jawaban, ad 2026) | 8 saran | **PILIH (B)** |
| 7 | soal psikotes tni pdf | 8 saran (download, ad pdf, kumpulan) | 8 saran | masuk artikel B |
| 8 | latihan psikotes tni | 8 saran (**online gratis** persis) | 2 saran | **PILIH (C)** |
| 9 | psikotes akmil | 8 saran (2026, pdf) | 3 saran | cadangan |
| 10 | soal psikotes tni 2026 | 8 saran (per matang + ad bintara 2026) | 8 saran | masuk artikel A/B |
| 11 | gaji tni bintara | 8 saran (2026, tunjangan, baru lulus) | 4 saran | demand ada tapi intent informasi gaji, bukan latihan — tulang punggung artikel belum waktunya |
| 12 | pagu gaji tni | **0 saran** | 0 saran | GUGUR — tak ada yang mencari |
| 13 | soal psikotes polri dan jawaban | 8 saran (…jawabannya pdf) | 8 saran | cadangan Polri |
| 14 | kisah sukses psikotes tni | **0 saran** | tidak relevan | GUGUR |

Ekspansi huruf-per-huruf pada 3 pemenang (48 kueri, `bukti_ekspansi.json`) menghasilkan 29 saran unik untuk cluster B saja — termasuk `contoh soal psikotes tni ad beserta jawabannya`, `soal psikotes tni ad bintara pdf`, `soal psikotes tni ad bintara 2026`, `psikotes tni ad bintara apa saja`. Ini menjadi bahan H2 di bagian 2.

**Alasan pemilihan 3**: (A) volume terbesar + intake terbesar TNI (bintara AD), (B) intent paling dekat transaksi — orang yang cari "contoh soal + jawaban" sedang memilih alat latihan, pas dengan diferensiasi SiapPsikotes (1.348 soal + pembahasan langkah demi langkah), (C) frasa free-tool yang persis cocok dengan halaman /contoh/ (40 soal gratis) sebagai corong masuk.

---

## 2. Spesifikasi 3 artikel untuk marketing-godin

Konvensi UTM: setiap artikel menautkan ke `/beli/?utm_source=artikel-{slug}&utm_medium=blog` (utama) dan `/contoh/?utm_source=artikel-{slug}&utm_medium=blog` (sekunder). Halaman /beli/ sudah membaca parameter utm untuk pelacakan funnel (docs/baseline-beli.md). Tonal: bicara ke calon casis, bukan ke guru; tanpa hard-sell di atas 1/3 bawah artikel.

### Artikel A — target `psikotes tni ad bintara`
- **Judul**: Psikotes TNI AD Bintara 2026: Materi, Contoh Soal, dan Cara Latihan yang Benar
- **Meta deskripsi** (155 char): Materi tes psikotes bintara TNI AD 2026, contoh soal + pembahasan tiap subtes, dan cara latihan online gratis tanpa akun. Siapkan diri sebelum hari-H.
- **H2 (urut)**:
  1. Psikotes TNI AD Bintara Itu Apa Saja? *(keyword: psikotes tni ad bintara apa saja)*
  2. Materi dan Urutan Tes Psikotes Bintara TNI AD *(kw: tes psikotes bintara tni ad)*
  3. Contoh Soal Psikotes TNI AD Bintara + Pembahasan *(kw: soal psikotes tni ad bintara, contoh soal)* — 10 soal contoh nyata dari bank /contoh/
  4. Beda Psikotes Bintara AD, AL, dan AU *(kw: psikotes bintara tni al / au — tangkap saran lintas matang)*
  5. Jadwal dan Alur Seleksi Bintara AD 2026 *(kw: psikotes tni ad 2026)*
  6. Cara Latihan Efektif 7 Hari Sebelum Tes *(link sekunder ke /contoh/)*
  7. FAQ: berapa lama psikotesnya, boleh gagal ulang tidak, dst.
- **Internal link utama**: setelah H2 ke-3 — "Mau latihan soal yang sama persis tipenya tanpa batas? Latihan 1.348 soal psikotes TNI dengan pembahasan langkah demi langkah di `/beli/?utm_source=artikel-psikotes-tni-ad-bintara&utm_medium=blog` — sekali bayar Rp 39.000, tanpa akun, bisa offline."
- **Keyword sekunder**: soal psikotes tni ad bintara pdf, soal psikotes tni ad bintara 2026 (kota konten: sebutkan 2026 persis).
- **Panjang**: 1.500–2.000 kata. **CTA**: 1 di tengah + 1 kotak CTA bawah.

### Artikel B — target `contoh soal psikotes tni dan jawaban(ja)`
- **Judul**: 25 Contoh Soal Psikotes TNI dan Jawabannya (Pembahasan Lengkap 2026)
- **Meta**: Kumpulan contoh soal psikotes TNI beserta jawaban dan pembahasan: analogi, silogisme, Kraepelin, Wartegg. Versi PDF dan latihan online gratis.
- **H2 (urut)**:
  1. Contoh Soal Analogi Kata + Pembahasan
  2. Contoh Soal Silogisme + Pembahasan
  3. Contoh Soal Tes Kraepelin dan Cara Mengerjakan
  4. Contoh Tes Wartegg: Gambar dan Penafsiran
  5. Contoh Soal Kepribadian (Proaktif, Sopan, dsb.)
  6. Download Kumpulan Soal Psikotes TNI PDF *(kw: soal psikotes tni pdf, download soal psikotes tni pdf — berikan PDF gratis benaran, ini lead magnet)*
  7. Cara Menghafal dan Melatih Kecepatan Jawaban
- **Internal link utama**: setelah H2 ke-6 — "PDF ini 25 soal. Bank soal SiapPsikotes 1.348 soal dengan pembahasan tiap nomor: `/beli/?utm_source=artikel-contoh-soal-tni&utm_medium=blog`."
- **Catatan taktis**: artikel ini peninggalan gratis + PDF = aset backlink (dikutip forum/blog), intent-nya paling dekat pembeli.
- **Panjang**: 2.000+ kata (halaman contoh soal suka di-bookmark dan dibagi).

### Artikel C — target `latihan psikotes tni online gratis`
- **Judul**: Latihan Psikotes TNI Online Gratis — 40 Soal Contoh Tanpa Akun
- **Meta**: Latihan psikotes TNI online gratis tanpa daftar akun: 40 soal contoh dengan pembahasan, langsung jalan di browser HP. Lanjut ke 1.348 soal bila sudah siap.
- **H2 (urut)**:
  1. Mulai Latihan Sekarang (Tanpa Daftar) *(embed/link /contoh/ di kalimat pertama — zero-friction)*
  2. Kenapa Latihan Tanpa Akun Lebih Efektif *(kw: latihan psikotes tni online — diferensiasi vs kompetitor yang minta signup)*
  3. Latihan Gratis vs Latihan Penuh: Kapan Naik ke 1.348 Soal
  4. Skor Penilaian Mandiri dan Target Nilai
  5. Pesan untuk Casis Bintara AD / AL / AU *(internal link lintas ke artikel A dan B)*
- **Internal link utama**: di H2 ke-3 — "Setelah 40 soal gratis tercapai 70+ skor, lanjutkan ke paket penuh di `/beli/?utm_source=artikel-latihan-gratis&utm_medium=blog`."
- **Panjang**: 1.200 kata; halaman ini cepat, fungsional, mirror dari alur /contoh/ → /beli/.

Eksekusi marketing-godin: tulis ketiganya minggu ini (A dulu — volume terbesar), internal-link silang antar artikel, satu link keluar ke /contoh/ dan satu ke /beli/ per artikel dengan utm di atas. Setelah tayang: submit URL ke Google Search Console (gratis) dan bagikan tautan artikel — bukan langsung /beli/ — di kanal bagian 3, supaya utm artikel yang tercatat.

---

## 3. Tabel 10 kanal organik (semua terverifikasi MEMBUKA hari ini, 19 Okt 2026)

Status buka dicek langsung: HTTP 200 + isi nyata. Bukti status: `bukti_status_kanal.json`; timestamp posting & deskripsi grup: `bukti_aturan_kanal.json`, `bukti_browser_tambahan.json`.

| # | Kanal | Ukuran (dicek hari ini) | Bukti hidup | Cara posting organik | Akun / karma | Kecocokan TNI | Prioritas |
|---|---|---|---|---|---|---|---|
| 1 | Kaskus komunitas/278 Lowongan Kerja | 160K thread, 16.1K anggota | Lounge "JOBSEEKER Kaskus" reply terakhir 21 Mei 2026; ada thread khusus pengalaman "gagal psikotes" | Reply bernilai di lounge jobseeker + thread baru "kumpulan soal psikotes + pembahasan" | Akun Kaskus gratis (guest tak bisa post); tanpa syarat karma publik — peraturan forum (ROE) wajib dibaca dulu | Sedang (jobseeker umum) | 1 |
| 2 | Kaskus komunitas/140 Militer (FORMIL) | 20.4K thread, 10.9K anggota | Lounge Formil 797.9K reply, terakhir 24 Sep 2026 | Jawab pertanyaan rekrutmen di thread "Pertanyaan Seputar Topik Kemiliteran Masuk DISINI!"; obey ROE Formil (strict, jangan OOT/jualan langsung) | Akun Kaskus; thread index tidak bisa diakses guest → harus akun + baca rules | Tinggi (komunitas TNI asli) | 1 |
| 3 | TG @grupbumn (Rekrutmen Bersama BUMN 2026) | 26.772 member | Deskripsi aktif RBB 2026; psikotes online = tahap 1 RBB → audiens di fase psikotes | Share tips + contoh soal psikotes online RBB, tautan /contoh/ | Akun TG, join bebas via t.me | Sedang-tinggi (tes psikotes sedang berjalan) | 1 |
| 4 | TG grup CPNS 1/2/3 (jalur @tocpns) | channel 795.449 subs; grup diskusi 138.849 member | Channel preview terbuka; grup cpnsdanpppk 1.737 online saat cek | Post di grup diskusi (bukan channel), format "3 soal + pembahasan" 1x/minggu | Akun TG | Sedang (psikotes kedinasan overlap) | 2 |
| 5 | TG @cpnsdanpppk_indonesia | 138.849 member, 1.737 online | Online count terlihat di preview | Sama seperti #4; grup penuh → baca deskripsi grup cadangan | Akun TG | Sedang | 2 |
| 6 | TG @openkerja (grup chat) | 255K subs channel; grup via openkerja.id/group | Post terakhir channel 1 Okt 2026 | Channel 1-arah → interaksi di grup chat; share latihan + artikel | Akun TG + join via openkerja.id/group | Rendah-sedang (loker umum, fresh graduate) | 2 |
| 7 | TG @informasi_cpns | 136.313 member | Grup utama CPNS 2026; backup resmi tercantum di deskripsi | Sama seperti #4 | Akun TG | Sedang | 3 |
| 8 | TG @lokercpnsbumn | 27.749 member | Preview terbuka | Share tips + artikel | Akun TG | Rendah-sedang | 3 |
| 9 | TG @PAPKTNI (PaPK TNI unofficial) | 508 member | Wadah sharing rekrutmen PaPK TNI (deskripsi resmi grup) | Diskusi persiapan PaPK = persis psikotes TNI; grup kecil → reply personal, bukan broadcast | Akun TG | Tinggi (TNI langsung) | 3 (volume kecil tapi paling tepat) |
| 10 | TG @casismiliter | 1.330 subs | ⚠️ DORMAN — post terakhir 22 Agu 2025 (timestamp preview) | Masih bisa posting; anggap archive, nol ekspektasi trafik | Akun TG | Tinggi tapi mati | 4 (hanya bila gratis) |

**Yang GUGUR dengan bukti** (task: "yang membuka, bukan 403"):
- **Quora** (id.quora.com & quora.com/topic/…): **HTTP 403** dua-duanya.
- **Reddit** (r/indonesia, r/indonesianmilitary): diblokir network security di www, old, dan endpoint JSON — 4 jalur gagal. Syarat karma r/indonesia tidak bisa diverifikasi dari sini; jadikan kanal tahun kedua bila akses berubah.
- **Facebook Group Casis**: HTTP 400 login wall — butuh akun FB + approval admin; tanpa kepastian rules, skip minggu ini.
- **TG @Materi_Psikotest_Kerja** (17.1K): post terakhir **Apr 2022** — mati. **TG @soalpsikotesonline** (113 subs): post terakhir **Des 2023** — mati. Keduanya ada di CSV kanal lama dengan label "aktif" — koreksi penting untuk tim.
- **detikForum**: DNS mati (NXDOMAIN).

Ritme anti-spam: maksimal 1 post/minggu per grup besar (grup RBB boleh 2 karena topik psikotes RBB tengah panas), format kontribusi ("3 soal + pembahasan", jawab pertanyaan orang) — bukan link drop. Setiap tautan membawa utm: `utm_source=telegram-{handle}` / `utm_source=kaskus-{komunitas}`, `utm_medium=sosial`.

---

## 4. Proyeksi kunjungan/minggu per kanal (`proyeksi_tabel.json`)

Formula: kunjungan/minggu = member × jangkauan-post × CTR-klik × post/minggu.
- Jangkauan: grup TG aktif 1–2,5%, forum 0,5–1,5%, grup dorman 0,3–1%.
- CTR klik: 5–10% — rentang dipinjam dari CTR dalam-funnel historis (audit D1: 1 klik_cta_bayar / 10 kunjungan_beli = 10%).
- ⚠️ Disclaimer jujur: belum ada satu pun posting historis kita di kanal mana pun, dan 10 event funnel 30 hari itu trafik test sendiri (kode SP-xxx, bukan utm kanal). Angka ini estimasi pra-eksperimen; minggu pertama adalah pengukuran baseline sesungguhnya — wajib pakai utm agar minggu depan proyeksinya dari data kita sendiri.

| Kanal | Member | Post/mgg | Proyeksi/mgg (rendah–tinggi) |
|---|---|---|---|
| TG @cpnsdanpppk_indonesia | 138.849 | 1 | 69–347 |
| TG @openkerja (grup chat) | 255.000 | 1 | 128–638 |
| TG grup CPNS via @tocpns | 138.849 | 1 | 69–347 |
| TG @informasi_cpns | 136.313 | 1 | 68–341 |
| TG @grupbumn (RBB) | 26.772 | 2 | 27–134 |
| TG @lokercpnsbumn | 27.749 | 1 | 14–69 |
| TG @PAPKTNI | 508 | 3 | 1–4 |
| TG @casismiliter (dorman) | 1.330 | 1 | 0–1 |
| Kaskus Loker (278) | 16.100 | 2 | 8–48 |
| Kaskus FORMIL (140) | 10.900 | 2 | 6–33 |
| **TOTAL** | | | **390–1.962** |

Baseline sekarang: 6 kunjungan/30 hari ≈ 1,4/minggu → kenaikan teoritis 278×–1.401×. Dengan CTR dalam-funnel 10%: 39–196 klik CTA bayar/minggu. Konversi ke bayar belum bisa diproyeksikan (bayar historis = 0; auto-unlock baru live) — inilah sebab minggu ini juga minggu pengukuran: setiap kanal satu utm unik.

SEO dari 3 artikel: nol di minggu pertama (indeks), mulai menyumbang bila long-tail masuk halaman 1 di minggu 3–6; Kaskus thread + backlink artikel mempercepatnya.

## 5. Jadwal eksekusi minggu ini (20–26 Okt)

- Sen–Sel: marketing-godin tulis artikel A + B, tayang, submit GSC.
- Rab: posting perdana TG @grupbumn + grup CPNS (3 soal + pembahasan + utm).
- Kam: reply perdana Kaskus lounge jobseeker + FORMIL (akun baru, bikin profil wajar dulu 2–3 hari).
- Jum: artikel C tayang; posting @openkerja grup chat.
- Sab–Min: ukur utm per kanal dari funnel peristiwa; isi ulang tabel proyeksi dengan CTR nyata.

## Lampiran bukti (tersimpan di task t_cea185aa)

- `bukti_autocomplete_raw.json` — status + saran mentah 14 frasa × 2 mesin
- `bukti_ekspansi.json` — 48 kueri ekspansi 3 pemenang (29 saran unik cluster B)
- `bukti_status_kanal.json` — status HTTP 16 URL (13×200, Quora 403×2, FB 400)
- `bukti_aturan_kanal.json` — deskripsi + timestamp posting 8 grup TG
- `bukti_browser_tambahan.json` — preview tocpns 795K, cpnsdanpppk 1.737 online, isi subforum Kaskus
- `proyeksi_tabel.json` — angka proyeksi + asumsi

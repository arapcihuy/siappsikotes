# Riset Akuisisi Pembeli — SiapPsikotes Rp 39.000 (Casis TNI/Polri)

Tanggal: 23 Oktober 2026 · Thompson (Head of Market Intelligence)
Status data: semua angka diambil langsung (browser/curl/yt-dlp) pada 23-10-2026, bukan ingatan.
Deliverable: workspace t_91d246bd → `kanal.csv` (14 kanal), `keyword.csv` (16 keyword), `pesaing.csv` (17 pesaing) + salinan file ini.
Ujian silang min. 3 sumber: harga pesaing dicek dari halaman asal (curl/direct) + riset pain point 22-10 + snippet indeks; forum memakai 3 sumber.

---

## KESIMPULAN SATI PARAGRAF

Pembeli psikotes TNI berkumpul di **Facebook + Instagram (239rb/173rb) + WhatsApp**, bukan Telegram (semua kanal Telegram niche sepi/usang); keyword transaksional paling luas yang belum ada arena street-nya adalah *beli soal psikotes TNI* (SERP berisi Shopee/Tokopedia belaka); dan harga Rp 39.000 nyaman di tengah: di bawah buku bestseller Rp 124rb & tryout 24 jam Rp 75,9rb, sedikit di atas PDF bundling Rp 35rb — jadi angle copy = **"lengkap + interaktif + sekali bayar"**, bukan "termurah".

## PLURALITY TES WARTEGG / KRAEPELIN — DATA PENTING DARI PENGOLAHAN OPERATOR

Operator (2026-10-23 00:44) sudah mengolah 152 autocomplete entries + 84 SERP hasil + harga gas + komunitas lingkup:
- **18 dari 152 keyword TIDAK punya halaman** — semuanya klaster Tes Wartegg (9) & Tes Kraepelin long-tail (9). Baru ditemui di keyword_autocomplete.csv (152 baris).
- **Situs TIDAK punya halaman Wartegg sama sekali.** Video Wartegg top = 250.329 views = permintaan terbesar seera.
- Harga Rp 39.000 di **kuartil bawah** (median pesaing Rp 55.000); 11 titik harga di bawah & 13 di atas dari 24 harga terkumpul.
- Channel Telegram layak hanya 2: soalpsikotestid 5.796, casismiliter 1.318 (skitar lain dead).

---

## 1) KANAL — 3 poin untuk serang minggu ini (marketing-godin)

1. **Grup FB "CASIS TNI/POLRI" (172.969 anggota, privat)** — target #1. Aktivitas rendah (9 postingan/bulan berdasarkan panel About FB) artinya noise kecil, satu konten bagus sangat terlihat. Eksekusi: gabung → baca pengumuman pinned → mulai dari **komentar jawaban** untuk pertanyaan member (utamanya pain point PP3 "tes gambar/bohong" & PP4 "kalah waktu" dari riset 22-10). Larangan keras: post iklan untuk disiapkan adalah tiketnya, bertanya answering adalah jalan keluarnya. Jangan situs diri.
2. **IG @casistnipolri.official (239 rb pengikut) + grup WA gratis di bio** — target #2. Mereka menganimasi anggota ke grup WhatsApp gratis tiap konten. Eksekusi: gabung grup WA itu (free), hadir harian di percakapan "soal hari ini", hingga tagar "anak-anak menayangkan tanya soal" punya tone percakapan — akhirnya link sisi-acak `siappsikotes.my.id` via pesan pribadi saat diminta. Bukan broadcast.
3. **Grup WA "CASIS TNI 2026 Gratis" via app.jadiprajurit.id/link + kaskus forum/575** — target #3. Halaman link pesaing membuka pintu masuk satu klik untuk komunitas aktif harian tanpa biaya; Kaskus forum Militer & Kepolisian (2,1K thread, 2,4K anggota) terbukti menerima thread iklan bimbel (Agst 2026, thread JW Bimbel) — potensi thread edukasi atau modul rawan anjar jadi desc.

Catatan tambahan: **Discord TIDAK masuk daftar** — Disboard diblokir Cloudflare dua jalur (urllib + browser) dan pencarian gagal menemukan server niche TNI jelas; **Telegram ditinggalkan sebagai market** — kanal terbesar hanya 5.796 subscriber dan postnya menurun (komunitascasis mati 2024, bidiktnipolri 2022, casismiliter "owner inactive 17 months"). YouTube comment masih #4: 45 video per leads_v5 dari riset minggu mereka; 6,42M views tes kraepelin top-8 berjalan paralel.

---

## 2) KEYWORD — 3 poin untuk angkan traffic (fullstack-dhh)

1. **LIP P0 "tes kraepelin" & "tes wartegg"** — Volume subtes spesifik bejauh: ytsearch top-8 kraepelin = 6.420.102 views; wartegg = 1.398.290; sedangkan "psikotes TNI" hanya 504.738. SERP = 6 tool-gratis generik (alokerja, belajarbro, izharishaksa, rekapcat, orangdalam, latihancat) yang **tidak ditulis khusus TNI**. Eksekusi: laman tool interaktif "Tes Koran 15 detik ala penilaian TNI" atau "cek 8 kotak Wartegg" di sisi situs (gratis, merusak via /beli/), atau blog comparison "kode lupa lupa tipe soal di tes TNI" — tier di laman produk.
2. **LIP P0 "beli soal psikotes TNI"** — SERP completely open: betul telarga Shopee/Tokopedia + PDF scribd. Tidak satu g retail riset laman web transaksional. Eksekusi: /beli/ indexed dengan slug/beli/beli-soal-psikotes-tni + judul H1 mengandung kata; tambahkan halaman "kisi-kisi 2026/2027" untuk mendukung DFC. Pesaing langsung di SERP PDF 250 soal Shopee (harga belum terekstrak).
3. **"latihan psikotes TNI online" & varian "2026" dua-duanya** — SERP bookmarks 6+ platform pesaing (latihancat, asninstitute, casis.or.id, siapdinas, eksam, app.jadiprajurit) yang jauh lebih mahal atau ber-timer; mesin SERP noklaring virtual "2026" menandakan fresh content windows per angka tahun. Eksekusi: lip "soal psikotes tamtama 2026" dan "soal psikotes polri 2026" (SERP jadiprajurit + casis — konten UGC sisa tetap menang) — potong dengan artikel 2026 di domain kita.

Waspadai jebakan: "soal psikotes online" = pasar kerja/BUMN (BCA/Indomaret di autocomplete), bukan TNI — bukan agar konten tim lekuk jualan; "psikotes akademi militer" volume terhemat.

---

## 3) HARGA PESAING — 3 poin (marketing-godin untuk copy /beli/)

1. **Posisi harga terverifikasi:** Rp 39.000 = **di bawah** buku bestseller Tokopedia Rp 124.000 (10rb+ terjual, rating 4,9); **di bawah** SILVER tryout Ruang Casis Rp 75.900 yang hanya punya akses 24 jam; **di bawah** semua paket bimbel online promo (Apta Rp 149.000, jadiprajurit Rp 129.000 diskon 57-70%) dan PDF+CAT PLC Rp 50.000–550.000; **sedikit di atas** bundle 7 e-book lynk.id Rp 35.000 & IAP apps Rp 4.000–25.000 per subtes. Copy anchor: **"Di bawah harga buku Rp 124rb — tapi 1.348 soal interaktif + pembahasan, tanpa install."**
2. **Jangan pakai klaim "termurah" mutlak** — lynk.id (7 e-book Rp 35rb) dan IAP app Rp 4-25rb mematahkan kalimat itu. Tegakan yang stockkaluable: "sekali bayar, semua modul terbuka, tanpa langganan/iklan" (pain point PP5 dari riset 22-10: "Kukira gratis gataunya berbayar", "soal terkunci", "iklan saat tes" — persis deskripsi eksplay pesaing IAP di atas).
3. **Tabel pembanding di /beli/ harus vs 3 format: PDF statis (Rp 35–50rb), aplikasi per-subtes (IAP Rp 4–90rb), bimbel online (Rp 129–699rb)** — angka via CSV pesaing. Alomgbad kemungkinan: tetalu lalu **jadiprajurit** adaladir pesaing terbesar total (app + tryout 14.979 peserta terverifikasi + TikTok 103,7K + paket Rp 129–500rb) — jangan bandingkan harga vs dia; bandingkan format vsnya (meyan ya RAW, luas verifikasi).

Angka untuk uji copy di /beli/: Rp 39.000 · 1.348 soal · 9 modul · sekali bayar · tanpa langganan.

---

## METODOLOGI & KETERBATASAN (jujur)

- Data diambil langsung 23-10-2026: Google autocomplete (20 seed), 14+ SERP per keyword, 7 halaman Play Store (rating+unduhan+IAP), halaman harga 6 situs pesaing (curl), halaman Facebook/IG/TikTok oleh browser, t.me meta 6 kanal, yt-dlp 8 video × 6 query.
- Belum terverifikasi penuh (single-source): jumlah pengikut @casispolri2026_id (188K, snippet saja), statistik Kaskus (2,1K thread — via snippet), harga Shopee PDF 250 soal (halaman butuh JS), pricing tombol premium casis.or.id (belum terbuka publik), Ruang Casis Rp 75.900/699.500 (snippet ×2, belum disentuh halaman asli).
- TikTok hashtag "psikokestni" tidak ada (TikTok bilang tagar tak ditemukan); Google Trends mengalami 429 — volume pakai proxy YouTube + autocomplete, jadi estimasi **relatif**, bukan pasang angka trending.2
- Isi detail sumber per baris ada di kolom `sumber` pada masing-masing CSV; mentah di raw_*.json workspace.

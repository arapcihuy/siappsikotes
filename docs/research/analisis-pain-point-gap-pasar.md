# Analisis Pain Point Pelanggan & Gap Pasar — Psikotes (SiapPsikotes)

> Thompson, Head of Market Intelligence · 2026-10-15 · Sumber: web search (exa/DDG) + dokumen riset internal `riset-pendatang-pembeli-psikotes-tni.md` & `analisis-fitur-premium.md`. Setiap klaim diberi tag keandalan: **confirmed** (≥2 sumber independen atau sumber resmi), **likely** (1 sumber kuat / data internal), **speculative**.

## Kesimpulan dulu

1. **Pain point terbesar bukan harga — tapi kepercayaan.** Pasar psikotes dibanjiri penipuan Telegram ("bocoran soal", "lolos tanpa tes", "pendaftaran berbayar") yang sudah diperingati resmi BKN. Pembeli tidak bisa membedakan produk sah dari modus. (confirmed)
2. **Ada jurang harga yang kosong di Rp30k–Rp150k.** Di bawah: aplikasi gratis dengan bank soal kecil, soal berulang, pembahasan minim, aturan penilaian salah. Di atas: bimbel Rp150k–Rp900k. Tidak ada produk psikotes-only yang kredibel di tengah. SiapPsikotes @Rp39k sudah berada di jurang itu — tapi belum diceritakan sebagai solusi jurang itu. (confirmed untuk struktur harga; positioning = rekomendasi)
3. **Keluhan produk yang konsisten di mana-mana: soal itu-itu saja (hafalan kunci, bukan latihan pola) dan tanpa umpan balik kelemahan.** Ini persis yang audit internal kita temukan di SiapPsikotes — artinya kita punya risiko churn yang sama kecuali fitur dinamis/diagnostik diprioritaskan. (confirmed: keluhan eksternal + audit internal)
4. **Niche TNI/Polri masih underserved oleh raksasa CPNS.** JadiASN, MisiPNS, Ruangguru dibangun untuk SKD (TWK/TIU/TKP). Psikometrik TNI (Kraepelin 60 detik/blok, Wartegg, tes koran, gambar) baru masuk sebagai fitur tambahan. Supply terfragmentasi (Scribd, blog, grup Telegram), permintaan teragregasi di pencarian "psikotes TNI" — titik agregasi klasik. (confirmed untuk fragmentasi; gap sizing = likely)
5. **Jangan kejar "bocoran soal".** Psikolog (Kompas, Agu 2026) menegaskan psikotes bisa dilatih tapi bukan dengan menghafal soal. Posisi "latihan pola + diagnosa kelemahan" adalah satu-satunya narasi yang sekaligus jujur dan tahan terhadap moderasi/penipuan. (confirmed kutipan psikolog; positioning = rekomendasi)

## 1. Peta pain point pelanggan (disertai bukti)

| # | Pain point | Bukti | Reliabilitas |
|---|---|---|---|
| P1 | **Penipuan & hoax mengkori pasar.** Grup Telegram jual "pendaftaran CPNS berbayar, kuota terbatas", "bocoran soal", "lolos tanpa tes". BKN membenarkan modus ini via @BKNgoid; CSIRT Pemda & media mempublikasikan peringatan (2022–2026, masih berlangsung di siklus 2026). | BKN via Ayo Bandung/Kabar Alam CSIRT Buleleng; Pojok Satu (Jul 2026) | confirmed |
| P2 | **Jurang harga.** Gratis = bank kecil/soal berulang/pembahasan minim/aturan salah; bimbel = Rp149k (Apta School), Rp449k–Rp900k (ASN Institute), hingga Rp27,7M (Taktikal, intensif fisik). Tidak ada psikotes-only kredibel di Rp30k–Rp150k. | MisiPNS blog (perbandingan eksplisit); riset internal (daftar harga 7 kompetitor) | confirmed |
| P3 | **Soal repetitif → hafalan kunci.** Aplikasi gratis "bank soal kecil sehingga cepat berulang"; audit internal SiapPsikotes: pengguna jenuh "itu-itu saja". Kompas (Agu 2026): psikolog tegaskan latihan ≠ menghafal soal. | MisiPNS blog; audit internal; Kompas | confirmed |
| P4 | **Tanpa umpan balik kelemahan.** Pengguna tahu skornya, tidak tahu kenapa salah dan harus latihan apa selanjutnya. Fitur evaluasi/analisis jadi pembeda utama yang dipakai semua kompetitor serius (MisiPNS, tes-cpns.com, AYOCPNS). | MisiPNS ("Materi Berserakan / Tanpa Feedback"); tes-cpns.com | confirmed |
| P5 | **Ketidaksetiaan format.** Simulasi dengan durasi/aturan penilaian keliru memberi gambaran kesiapan yang salah (SKD = 110 soal/100 menit; TWK/TIU benar-5-salah-0; TKP skala 1–5). | MisiPNS blog | likely (sumber tunggal, tapi spesifik & konsisten dengan BKN) |
| P6 | **Pelaksanaan psikotes SKB bermasalah secara institusional** (jadwal/server, keluhan 2024 di Kemen PUPR & ESDM). | Kabar Alam (2024) | likely — di luar kendali kita, tapi sumber lead content |
| P7 | **Kebutuhan psikometrik TNI spesifik** (Kraepelin/Wartegg/gambar/koran) tidak tercakup aplikasi CPNS umum; materi TNI tersebar di Scribd/blog/grup, kualitas tak terjamin. | Scribd (dokumen TNI AD), jadiprajurit.id, rumahtaruna.id; MisiPNS baru tambahkan "simulasi psikotes sekdin" | confirmed untuk fragmentasi supply |

## 2. Gap pasar (kerangka rantai nilai / Aggregation Theory)

- **Sisi supply terfragmentasi:** soal psikotes TNI tersebar di Scribd, blog pribadi, grup Telegram, file Google Docs grup FR. Tidak ada agregator kredibel untuk *psikometrik TNI/Polri* — semua agregator besar (JadiASN, MisiPNS, Ruangguru, Quipper) berorientasi SKD. (confirmed)
- **Sisi permintaan teragregasi di pencarian:** keyword "latihan psikotes TNI", "tryout psikotes TNI", "soal psikotes TNI terbaru" konsisten dicari (data kata kunci internal, likely). Demand musiman: spike menjelang gelombang pendaftaran CPNS/TNI — produk harus bisa melonjak tanpa biaya tetap (cloud tier gratis).
- **Mata rantai paling menguntungkan = kepercayaan + diagnostik, bukan konten.** Konten mudah disalin (dan memang dibajak ke Telegram). Yang tidak bisa disalin: aturan penilaian yang benar, analisis kelemahan personal, dan reputasi anti-bocoran. Inilah mata rantai tempat diferensiasi sisi supply satu-satunya untuk pengembang independen.
- **TAM→SAM→SOM (speculative, jangan dijadikan angka final):** TAM = seluruh pencari seleksi ASN/TNI/Polri/BUMN (jutaan per siklus, musiman). SAM = segmen psikotes yang rela bayar (bukan pemburu bocoran gratis). SOM realistis dengan Rp39k + kanal organik = ratusan–ribuan transaksi per gelombang pendaftaran, bukan puluhan ribu — karena pembeli psikotes TNI mayoritas sudah terlebih dahulu membeli bimbel SKD dan menganggap psikotes "pelengkap".

## 3. Tren struktural vs hype

- **Tren struktural:** (a) seleksi CAT/online permanen pasca-pandemi; (b) AI digunakan kompetitor untuk pembahasan (MisiPNS "MasAI") — baseline baru, bukan pembeda; (c) kesadaran bahwa psikotes *bisa dilatih* (Kompas) — menaikkan willingness to pay untuk latihan terstruktur. (confirmed)
- **Hype:** narasi "bocoran soal CPNS 2026" dan "lolos tanpa tes" — atensi tinggi, uang rendah, risiko reputasi & hukum. Jangan disentuh. (confirmed)
- **Jurang "keren → mau bayar":** niat beli tertinggi terjadi dalam jendela 2–6 minggu sebelum tes, bukan setahun sebelumnya. Konten organik (TikTok/Reels/Kaskus) harus di-timing ke kalender seleksi, bukan diposting merata. (likely — konsisten dengan sifat musiman pendaftaran)

## 4. Rekomendasi aksi (dipisah dari fakta)

1. **Reposisi messaging SiapPsikotes** ke tiga frasa pembuktian: "bukan bocoran — latihan pola", "tahu kenapa kamu salah", "aturan penilaian mengikuti aslinya". Ini menjawab P1+P3+P4+P5 sekaligus dan tidak bisa disalin kompetitor Telegram. (pemilik produk: konten /beli/ + landing)
2. **Prioritaskan fitur diagnostik kecil** (rekap kategori soal yang paling sering salah + soal belum dikerjakan didahulukan) sebelum menambah volume soal — langsung menjawab P3/P4, dan audit internal sudah memetakan ini sebagai fitur konversi tertinggi.
3. **Modul psikometrik TNI sebagai diferensiasi niche** (Kraepelin 60-detik/blok, kecermatan, Wartegg/gambar) — area yang diabaikan raksasa CPNS. Verifikasi dulu format resmi terbaru tiap matra sebelum produksi soal (quality gate repo tidak boleh diturunkan).
4. **Trust signal di checkout:** pernyataan eksplisit "bukan bocoran soal resmi" + sumber harga transparan — melawan P1, sekaligus mengurangi risiko klaim.
5. **Timing kanal organik** (dari t_0b1f69d0: TikTok Live, IG Reels, Kaskus) ke kalender gelombang pendaftaran TNI/CPNS berikutnya; ukur CAC per kanal seperti yang sudah direncanakan.
6. **Jangan:** ikut menjual "kunci jawaban/bocoran", dan jangan menaikkan harga ke >Rp100k tanpa fitur diagnostik dulu — itu wilayah bimbel yang punya live class.

## 5. Sumber

- BKN official via Ayo Bandung (penipuan Telegram "CPNS Jalur Berbayar"): https://www.ayobandung.com/umum/pr-794086820/waspada-penipuan-pendaftaran-cpns-2022-berbayar-calon-asn-harus-jeli
- CSIRT Buleleng (hoax pendaftaran berbayar, BKN mengonfirmasi): https://csirt.bulelengkab.go.id/konten/detail/pendaftaran-cpns-2022-berbayar-dan-kuota-terbatas
- Pojok Satu (hoaks CPNS 2026, 4 ciri penipuan): https://www.pojoksatu.id/edugov/1086863809/hati-hati-muncul-penawaran-lolos-cpns-2026-tanpa-tes-ini-4-ciri-penipuan-yang-paling-umum
- Kompas (psikolog: psikotes bisa dilatih, bukan menghafal): https://www.kompas.com/tren/read/2026/08/03/123000265/psikotes-cpns-dan-pppk-bisa-dipelajari-psikolog-ungkap-cara-latihan-yang
- MisiPNS Play Store + blog perbandingan aplikasi (batasan aplikasi gratis: bank kecil, berulang, pembahasan minim, aturan keliru): https://www.misipns.com/blog/aplikasi-belajar-cpns-terbaik-2026
- rsiakartini (perbandingan 5 aplikasi CPNS gratis; CAT BKN resmi lambat saat puncak): https://rsiakartini.id/5-aplikasi-latihan-soal-cpns-2026-gratis-rekomendasi-dan-perbandingan/
- tes-cpns.com (evaluasi hasil sebagai kriteria utama pilih tryout): https://tes-cpns.com/artikel/8-rekomendasi-tryout-online-cpns-2026-untuk-persiapan-skd
- Reddit r/indonesia (diskusi kesulitan TWK/TIU, kuota formasi sedikit): https://www.reddit.com/r/indonesia/comments/1t1igis/how_hard_is_cpns_test_compare_to_utbk/
- Kabar Alam (keluhan pelaksanaan psikotes SKB 2024): https://www.kabaralam.com/berita/59314204291/keluhan-soal-pelaksanaan-psikotes-skb-cpns-2024-juga-terjadi-di-kementerian-esdm
- Fragmentasi supply psikotes TNI: Scribd "Latihan Tes Psikologi TNI AD" (https://id.scribd.com/document/870188788/), jadiprajurit.id/tes-psikotes-tni-ad/, rumahtaruna.id/aplikasi-latihan-psikotes-tni/
- Kompetitor TNI/Polri: CASIS (casis.or.id), testnipolri.com, psikotestpolri.id, Ruang Casis (ruangcasis.id), Apta School Rp149k (aptaschool.com/bimbel-online-polri/)
- Harga pesaing (internal): docs/research/riset-pendatang-pembeli-psikotes-tni.md; audit soal internal: docs/research/analisis-fitur-premium.md

---
*Fakta dipisah dari rekomendasi di atas. Angka yang belum diverifikasi ditandai speculative — jangan dipakai untuk proyeksi pendapatan sebelum verifikasi kalender seleksi resmi TNI/CPNS gelombang berikutnya.*

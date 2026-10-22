# PR/FAQ — Simulasi Tryout (halaman /simulasi-tryout/)

Status: **Live** (rilis 2026-10-23, tugas board t_ec85dbfb)
Anchor harga: **Rp 39.000** — paket akses premium, konsisten dengan halaman /beli/.

## PR (ringkas)

Latihan soal biasa ramah waktu: terserah kapan selesai, boleh bolak-balik membuka catatan.
Di hari ujian, dua kelonggararan itulah yang paling mahal: waktu terbatas dan giliran
mengingat di bawah tekanan. Simulasi Tryout melatih keduanya dengan memformat latihan
menjadi ujian sungguhan:

1. **Jumlah soal tetap** — 120 butir per sesi penuh, komposisi mata uji selalu sama.
2. **Fitur timer mundur** — 120 menit; waktu habis membuat sesi ditutup otomatis,
   dan soal yang belum dijawab dihitung kosong.
3. **Skor akhir + rincian per mata uji** — selesai sesi, pengguna memperoleh skor
   (persen benar) dan tabulasi benar/salah/kosong tiap mata uji, dengan **area terlemah**
   disorot supaya sesi berikutnya punya arah, bukan mengulang kebiasaan lama.

### Prinsip desain (Don Norman)

- **Affordance**: tombol sesi licin dua tingkat — demo gratis bertanda "gratis",
  tombol sesi penuh bertanda "kode akses", sehingga gerbang tidak mengagetkan.
- **Feedback & status terlihat**: timer dan kemajuan selalu di bar atas kertas soal;
  peta nomor soal (1–120) diberi warna tebal pada yang sudah dijawab, jadi status
  sesi tidak perlu diingat di kepala.
- **Constraints & pemulihan**: "Selesai & lihat skor" memakai dialog persetujuan;
  kode yang salah tidak mengunci apa pun — pengguna cukup membetulinya.

### Kejujuran copy (gate repo ditaati)

- Copy memakai tiga frasa wajib dari brief: **latihan berformat ujian**, **fitur timer**,
  **lihat area terlemah** (versi: "area terlemahmu").
- Penyangkalan tersohor: soal latihan buatan platform ini, **bukan soal ujian instansi**,
  tanpa klaim afiliasi instansi mana pun.
- Larangan gate: **tanpa 'soal resmi' (non-penyangkalan), 'pasti lulus', 'dijamin',
  'terbaik', 'nomor 1'**, tanpa testimoni/angka penjualan yang tidak ada datanya.
- Pembelian: **"kode aktif setelah dicek"** — bukan "kode akses instan".

## FAQ (pertanyaan pengguna)

| Pertanyaan | Jawaban yang ditampilkan |
|---|---|
| Apakah ini soal ujian resmi instansi? | Tidak. Ini bank soal latihan milik platform ini; tidak ada campur tangan instansi seleksi mana pun. |
| Apakah skor tinggi berarti dijamin lolos? | Tidak. Skor hanya ukuran latihan di bawah timer — cermin persiapan, bukan kepastian hari ujian. |
| Kode akses masuk kapan setelah bayar? | Pembayaran diperiksa oleh pemilik dulu, lalu kode dikirim: **kode aktif setelah dicek**. |
| Apa komposisi soal sesi penuh? | Wawasan kebangsaan 30 · matematika 25 · bahasa Inggris 16 · penalaran & logika 18 · kemampuan numerik 21 · kemampuan verbal 10. |
| Apakah sesi bisa dipakai ulang? | Ya, setiap sesi mengacak soal ulang dari bank yang sama. |

## Spesifikasi teknis minimal

Rincian lengkap: `docs/product/spesifikasi-teknis-simulasi-tryout.md`.

- Halaman: `simulasi-tryout/index.html` (satu berkas; CSS + JS inline; CSP seperti halaman landing lain).
- Data soal: **berkas bank yang sama dengan aplikasi utama** (`data/soal-*.js`) — tidak ada
  salinan data kedua, sehingga gate mutu `data/soal.js` ikut mengikat halaman ini.
- Komposisi tetap (di atas) = 120 soal; demo = 20 soal / 25 menit.
- Gerbang premium: sidik kode sama dengan `static/js/fitur11.js` (`KUNCI_KODE`),
  disimpan `localStorage.tni_kode_akses` — pembeli aplikasi otomatis lewat tanpa backend baru.
- Pelacakan: beacon ke `/api/pantau` — jenis `tryout_kunjungan` (muat halaman) dan
  `tryout_klik_beli` (klik CTA beli), utm per event, `is_test` mengikuti pola utm `uji-/probe/…`.
- Deploy: push `master` (GitHub Pages) + `npx wrangler deploy` di `server/` untuk whitelist event baru.

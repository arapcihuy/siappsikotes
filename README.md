# SiapPsikotes — Latihan Psikotes Kerja & Tes IQ Berpembahasan

Situs: **https://siappsikotes.my.id**

Aplikasi latihan psikotes berbahasa Indonesia untuk pencari kerja dan peserta
seleksi: deret angka, penalaran, padanan kata, daya ingat, kraepelin, TIU/TWK
CPNS, sampai tes kepribadian. Semua soal disertai pembahasan.

- Bisa dipakai tanpa akun dan bisa dibuka offline (PWA).
- Ada mode latihan bebas dan mode tryout berwaktu.
- Ringkasan hasil muncul langsung di perangkat, tanpa mengirim data ke mana pun.

## Mulai dari sini

| Kebutuhan | Halaman |
| --- | --- |
| Latihan umum untuk melamar kerja | https://siappsikotes.my.id/contoh-soal-psikotes-kerja/ |
| Deret angka | https://siappsikotes.my.id/contoh-soal-deret-angka/ |
| Tes IQ / penalaran | https://siappsikotes.my.id/psikotes/ |
| TIU & TWK CPNS | https://siappsikotes.my.id/contoh-soal-tiu-cpns/ |
| Semua contoh soal per jenis seleksi | https://siappsikotes.my.id/contoh/ |

Halaman contoh soal lain: [Bahasa Inggris](https://siappsikotes.my.id/contoh-soal-psikotes-bahasa-inggris/),
[daya ingat](https://siappsikotes.my.id/contoh-soal-psikotes-daya-ingat/),
[matematika](https://siappsikotes.my.id/contoh-soal-psikotes-matematika/),
[kraepelin](https://siappsikotes.my.id/contoh-soal-tes-kraepelin/),
[kepribadian](https://siappsikotes.my.id/contoh-soal-psikotes-kepribadian/).

## Akses penuh

Latihan dasar gratis. Akses penuh (seluruh bank soal dan tryout) Rp 39.000
sekali bayar lewat QRIS, tanpa langganan — lihat https://siappsikotes.my.id/beli/.

## Untuk kontributor

Bank soal diperiksa otomatis: akurasi kunci jawaban, konsistensi pembahasan, dan
aturan mutu soal di `PEDOMAN-MUTU-SOAL.md` bersifat wajib. Jangan menambah atau
mengubah soal sebelum membaca pedoman tersebut.

Jalankan gerbang pemeriksaan yang sama dengan CI sebelum mengirim perubahan:

```bash
bash tools/periksa-sebelum-kirim.sh          # pemeriksaan lengkap
bash tools/periksa-sebelum-kirim.sh --cepat  # lewati uji peramban
```

Halaman artikel contoh soal dibangun dari berkas JSON di `naskah/`:

```bash
python3 tools/buat-artikel.py
```

Struktur singkat: `data/` bank soal, `naskah/` naskah artikel, `tools/` pembangun
dan gerbang mutu, `static/` aset aplikasi, `server/` Worker untuk akun dan progres.

## Penyangkalan

SiapPsikotes bukan produk resmi instansi mana pun dan tidak berafiliasi dengan
perusahaan atau lembaga seleksi mana pun. Materi di sini adalah latihan mandiri
dan tidak menggantikan pengumuman resmi tahapan seleksi.

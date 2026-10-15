# Optimasi Halaman /beli/ — QRIS Rp 39.000 Lebih Mudah

Tanggal: 2026-10-16
Task: t_d3b9ee16
Repo: ~/tni-belajar
Branch target: master (hanya jika lolos gate)

## Ringkasan Perubahan
- Mengurangi resource hints: preload hanya WebP QRIS, hapus preload AVIF/PNG ganda. Target <2s load 3G.
- Prioritaskan WebP di `<picture>`: source WebP ditaruh sebelum AVIF.
- Hapus banner survei pricing yang menghasilkan JS + DOM tidak perlu, mengurangi friction checkout dan beban jaringan.
- Hapus kode survey dari script.js.
- Tambah auto-select rujukan/nominal saat diklik: memudahkan salin tanpa copy-paste manual.
- UI tetap server-render + progressive enhancement, tanpa Turnstile/CAPTCHA.
- Tidak ada perubahan pada data soal atau logika bank soal.

## Verifikasi
- peraturan-mutu.py: SEMUA PERATURAN DIPATUHI (1348 soal, sebaran kunci 340/340/331/337, rasio kunci terpanjang 24%)
- Halaman /beli/ load <2s target, QRIS render eager fetchpriority high, prefetch aplikasi pada hover/touch.
- QRIS WebP preload, generate rujukan client-side <1s.
- Tidak ada Turnstile/CAPTCHA di halaman checkout.
- Webhook payment tetap terkirim via sendBeacon pada event kunjungan, klik CTA, tampilkan kode, dll.

## Artefak
- Modified: beli/index.html
- Modified: beli/script.js
- New doc: docs/fullstack/beli-qris-optimasi-2026-10-16.md

## Catatan Penerapan
- Push ke master hanya setelah gate lulus. Gate memeriksa tools/peraturan-mutu.py + PEDOMAN-MUTU-SOAL.md, tidak menyentuh UI.
- Perubahan UI tidak menurunkan akurasi bank soal atau test suite.

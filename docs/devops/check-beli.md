# Regression Check /beli/ Speed & Friction

Script otomatis untuk mendeteksi regresi performa dan friksi checkout di halaman `/beli/`.

## Tujuan
Memastikan:
- Halaman memuat ≤ 2 detik (baseline ~0.42s setelah optimasi)
- QRIS `#qris` terlihat tanpa scroll berlebihan (≤ 1200px)
- Harga Rp 39.000 terlihat di `#displayHarga` dan nominal di `#beliNominal` diawali Rp 39.
- Jalur dari CTA `#ctaBayar` ke pembayaran `#bayar` ≤ 1 langkah (anchor langsung)

Script ini lulus pada halaman yang sudah dioptimalkan dan akan gagal pada baseline lama.

## Jalankan lokal
```bash
node tools/check-beli.mjs
```
Butuh Playwright Chromium. Pertama kali:
```bash
npx playwright install chromium
```

Exit code 0 = PASS, 1 = FAIL.

## Jalankan di CI
Tambahkan step:
```bash
node tools/check-beli.mjs
```

## Threshold yang dipakai
`LOAD_THRESHOLD_MS=2000`
`MAX_SCROLL_PX_TO_QRIS=1200`
`MAX_STEPS_TO_PAYMENT=1`

Ubah konstanta di atas jika baseline berubah.

## Catatan
Tidak menyentuh bank soal atau test suite. Hanya membaca `beli/index.html` via file://.

# Feed Produk — SiapPsikotes & Cardcheck

Feed machine-readable untuk dipakai kanal penjualan mana pun (marketplace gratis, chatbot, Google Merchant
gratis tier, toko produk digital). Tidak perlu deploy apa pun — worker lain cukup baca file ini.

## Berkas

| Berkas | Isi | Dipakai untuk |
|---|---|---|
| `produk.json` | Feed kanonik: 4 entri produk, pembulatan detail (FAQ list, tipe, tautan) | Chatbot, integrasi API, sumber kebenaran |
| `produk.csv` | Versi flat kolom wide, FAQ digabung jadi satu kolom TSV (`faq_tersemat`, pemisah ` // `) | Upload Google Merchant CSV, spreadsheet marketplace, generator listing |

## Kontrak data (jangan diubah sepihak)

- Kolom: `product, paket, harga_rp, harga_tampil, deskripsi_singkat, tipe_bayar, stock, category,
  link_beli, link_coba_gratis, faq_tersemat`
- `harga_rp` = angka bulat tanpa titik (39000, bukan "Rp 39.000").
- `stock` selalu `unlimited` (produk digital; marketplace lain abaikan kolom ini).
- `link_beli` TIDAK perlu diedit — UTM (`utm_source=marketplace&utm_medium=feed&utm_campaign=<id>`) sudah
  tersemat, `/beli/` dan landing Cardcheck membaca parameter tersebut untuk pelacakan funnel. Kalau kanal
  ingin UTM sendiri, ganti `utm_source`/`utm_campaign` saja; struktur param tetap.
- Harga published yang valid hari ini: Rp 39.000 (akses penuh), Rp 99.000 (bundel 3), gratis (40 soal
  contoh, Cardcheck). Flash sale Rp 19.000 itu kampanye terbatas — jangan disimpan identik 19.000 di feed.

`produk.csv` dibangkitkan dari `produk.json` — kalau harga/deskripsi berubah, ubah JSON, lalu generate ulang
CSV (script kolom di riwayat git; kolom `category` juga diset di generator). Satu file jadi sumber, satu
file hasil, supaya tidak ada dua definisi harga.

## Proyeksi kanal marketplace

Judul & deskripsi panjang untuk listing manual (Shopee/Tokopedia) tetap di
`output/LISTING-SIAP-TEMPEL.md` dan `docs/marketing/`. Feed ini bukan penggantinya — ini versi mesin.

## Ringkasan entri

1. SiapPsikotes — Akses Penuh + Laporan Lengkap — Rp 39.000 — sekali bayar
2. SiapPsikotes — Bundel 3 laporan (3 orang) — Rp 99.000 — sekali bayar
3. SiapPsikotes — Coba Gratis 40 soal — Rp 0
4. Cardcheck — OG & Twitter Card Checker — Rp 0 (gratis) — https://cardcheck.rasyidahmad180.workers.dev

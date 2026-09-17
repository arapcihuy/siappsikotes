#!/usr/bin/env python3
"""Susun berkas 'siap tempel' untuk listing Shopee/Tokopedia dari MARKETPLACE-LISTING.md.

Tujuannya memangkas pekerjaan tangan: seluruh isian platform dikumpulkan urut,
satu blok per kolom, supaya tinggal salin-tempel tanpa mencari di dokumen panjang.

Pakai: /usr/bin/python3 tools/susun-listing.py
Hasil: ~/pk-bisnis/LISTING-SIAP-TEMPEL.md
"""
import os
import re
import sys

SUMBER = os.path.expanduser('~/pk-bisnis/MARKETPLACE-LISTING.md')
KELUAR = os.path.expanduser('~/pk-bisnis/LISTING-SIAP-TEMPEL.md')


def bagian(teks, nomor):
    """Ambil isi satu bagian '## <nomor>.' sampai sebelum '## ' berikutnya."""
    pola = re.compile(r'^##\s*%s\..*?$' % nomor, re.M)
    m = pola.search(teks)
    if not m:
        return ''
    sisa = teks[m.end():]
    n = re.search(r'^##\s', sisa, re.M)
    return sisa[:n.start()].strip() if n else sisa.strip()


def main():
    isi = open(SUMBER, encoding='utf-8').read()
    judul = bagian(isi, 2)
    deskripsi = bagian(isi, 3)
    harga = bagian(isi, 5)
    tanya = bagian(isi, 6)
    balasan = bagian(isi, 7)

    if not (judul and deskripsi and harga):
        print('GAGAL: bagian wajib tidak ditemukan di %s' % SUMBER)
        return 1

    dok = """# LISTING SIAP TEMPEL — Shopee & Tokopedia

Disusun 14 September 2026 dari `MARKETPLACE-LISTING.md`. Urutannya mengikuti kolom isian
di platform, jadi cukup salin blok demi blok tanpa mencari di dokumen panjang.

**Sebelum mulai:** siapkan 5 gambar di `~/pk-bisnis/gambar-marketplace/` (sudah jadi,
1080x1080) dan satu kode akses cadangan dari `tools/kode-pembeli.py` untuk uji coba
pembelian sendiri.

---

## 1. Kolom "Nama Produk"

Salin salah satu (batas Tokopedia 70 karakter; semuanya sudah dihitung):

%(judul)s

---

## 2. Kolom "Deskripsi Produk"

%(deskripsi)s

---

## 3. Kolom "Harga" & "Stok"

%(harga)s

---

## 4. Kolom "Gambar Produk" (urutan unggah)

| Urutan | Berkas | Isi |
|---|---|---|
| 1 | `gambar-marketplace/01-gambar-utama.png` | soal asli + angka 1.348 |
| 2 | `gambar-marketplace/02-isi-lengkap.png` | daftar kategori + jumlah soal |
| 3 | `gambar-marketplace/03-cara-pakai.png` | bayar, kirim bukti, terima kode |
| 4 | `gambar-marketplace/04-nilai-jujur.png` | 40 soal gratis, tanpa akun, bisa offline |
| 5 | `gambar-marketplace/05-harga-syarat.png` | harga sekali bayar + syarat |

---

## 5. Kolom "Kategori Produk"

Rekomendasi: **Buku & Alat Tulis > Buku Pendidikan > Persiapan Ujian** (Shopee) atau
**Buku > Pendidikan > Persiapan Ujian** (Tokopedia). Kalau tidak tersedia, pilih
**Kursus & Pelatihan Online** sebagai alternatif. Jangan pilih kategori barang fisik.

Jenis produk: **non-fisik / digital**. Pengiriman: pilih opsi pengiriman instan bila ada;
kalau tidak, tulis di deskripsi bahwa pengiriman dihitung sejak kode dikirim.

---

## 6. Tanya-Jawab pembeli (tempel ke kolom FAQ / chat)

%(tanya)s

---

## 7. Balasan otomatis pembeli baru (tempel ke fitur auto-reply)

%(balasan)s

---

## 8. Ingat setelah listing tayang

- Setiap ada pembayaran masuk: buat kode dengan
  `/usr/bin/python3 tools/kode-pembeli.py --rujukan SP-xxx --nominal 39xxx`
  lalu kirim pesan balasan yang dihasilkan alat itu.
- Catat setiap penjualan di `PENJUALAN.csv` supaya pencocokan mudah.
- Jangan pakai kata "dijamin lolos", "soal asli", atau "resmi" di kolom mana pun
  (daftar klaim terlarang: `ATURAN-JUJUR-MARKETING.md`).
- Uji sendiri: beli produkmu sekali lewat akun pembeli, pastikan alurnya jalan.
""" % {
        'judul': judul,
        'deskripsi': deskripsi,
        'harga': harga,
        'tanya': tanya,
        'balasan': balasan,
    }

    open(KELUAR, 'w', encoding='utf-8').write(dok)
    print('berkas   : %s' % KELUAR)
    print('ukuran   : %.1f KB' % (os.path.getsize(KELUAR) / 1024.0))
    # rapikan: buang baris pemisah ganda yang terbawa dari dokumen sumber
    dok = dok.replace('---\n\n---', '---')
    open(KELUAR, 'w', encoding='utf-8').write(dok)
    for nama, blok in [('nama produk', judul), ('deskripsi', deskripsi), ('harga', harga),
                       ('tanya-jawab', tanya), ('balasan otomatis', balasan)]:
        print('  bagian %-18s %5d karakter' % (nama, len(blok)))
    if any(len(b) < 30 for b in [judul, deskripsi, harga]):
        print('PERINGATAN: ada bagian yang terlalu pendek, periksa dokumen sumbernya')
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())

#!/usr/bin/env python3
"""Periksa kata terlarang di copy /beli/ (COPY_BELI di server/src/index.js).

Gate buat-artikel.py memeriksa NASKAH artikel, bukan copy varian A/B di Worker.
Akibatnya klaim "pola tes resmi" lolos ke /beli/ live (23 Okt 2026).
Skrip ini menutup celah itu: exit 1 kalau ada klaim terlarang.

Aturan: kata "resmi" BOLEH hanya dalam bentuk penyangkalan
("bukan produk resmi instansi", "bukan tes resmi"). Kalau muncul tanpa penyangkalan,
dianggap klaim -> GAGAL.
"""
import os, re, sys

# frasa multi-kata yang dilarang apa adanya
TERLARANG = ['dijamin', 'pasti lulus', 'pasti diterima', 'satu-satunya',
             'nomor 1', 'terbaik', 'bekerja sama dengan', 'akurat 100%',
             'gratis selamanya', 'akses terjual', 'sudah terjual',
             'testimoni pembeli', 'soal asli']
# penyangkalan yang SAH - dihapus dulu sebelum pemeriksaan
SAH = [r'bukan\s+(?:produk\s+)?resmi[^<.\']*', r'bukan\s+tes\s+resmi[^<.\']*',
       r'tidak\s+berafiliasi[^<.\']*']

def main():
    p = os.path.expanduser('~/tni-belajar/server/src/index.js')
    if not os.path.exists(p):
        print('LEWAT: server/src/index.js tidak ada'); return 0
    src = open(p, encoding='utf-8').read()
    m = re.search(r'const COPY_BELI = \{(.*?)\n\};', src, re.S)
    if not m:
        print('LEWAT: COPY_BELI tidak ditemukan'); return 0
    blok = m.group(1).lower()
    for frasa in SAH:
        blok = re.sub(frasa, '', blok)
    salah = [k for k in TERLARANG if k in blok]
    # kata "resmi" yang tersisa setelah penyangkalan dihapus = klaim
    if re.search(r'\bresmi\b', blok):
        salah.append('resmi (klaim, bukan penyangkalan)')
    if salah:
        print('GAGAL: klaim terlarang di COPY_BELI -> %s' % salah)
        return 1
    print('OK    | COPY_BELI bersih: tidak ada klaim terlarang (%d frasa + kata "resmi" non-penyangkalan)'
          % len(TERLARANG))
    return 0

if __name__ == '__main__':
    sys.exit(main())

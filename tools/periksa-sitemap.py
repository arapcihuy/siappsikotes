#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Periksa: setiap direktori halaman di repo WAJIB terdaftar di sitemap.xml.

Latar belakang (23 Okt 2026): worker membuat /simulasi-tryout/ sampai live HTTP 200,
lengkap dengan title/description/canonical, TAPI tidak pernah didaftarkan di
sitemap.xml. Hasilnya halaman itu tidak terindeks mesin pencari - pekerjaan selesai
tetapi tidak menghasilkan apa pun. Gate lama tidak menangkapnya karena hanya
memeriksa halaman yang SUDAH ada di daftar HALAMAN (pasang-seo.py), sehingga halaman
yang lupa didaftarkan justru luput dari pemeriksaan.

Pemeriksa ini bekerja dari arah sebaliknya: memindai disk, lalu memastikan tidak ada
halaman yang tertinggal dari sitemap.

Pakai:
    python3 tools/periksa-sitemap.py          # keluar 1 kalau ada yang terlewat
    python3 tools/periksa-sitemap.py --verbose
"""
import os
import re
import sys

AKAR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITEMAP = os.path.join(AKAR, "sitemap.xml")

# Direktori yang bukan halaman publik (tidak wajib masuk sitemap).
KECUALI = {
    "dashboard",      # panel internal, sengaja tidak diindeks
    "survei",        # noindex: survei riset harga, bukan halaman publik
    "static",
    "aset-bisnis",
    "node_modules",
    "docs",
    "naskah",
    "tools",
    "tests",
    ".gen",
    ".git",
}


def baca_sitemap():
    if not os.path.exists(SITEMAP):
        return None
    isi = open(SITEMAP, encoding="utf-8").read()
    return set(re.findall(r"<loc>https?://[^/]+(/[^<]*)</loc>", isi))


def halaman_di_disk():
    hasil = []
    for nama in sorted(os.listdir(AKAR)):
        jalur = os.path.join(AKAR, nama)
        if not os.path.isdir(jalur) or nama in KECUALI or nama.startswith("."):
            continue
        if os.path.exists(os.path.join(jalur, "index.html")):
            hasil.append(nama)
    return hasil


def main():
    verbose = "--verbose" in sys.argv

    lok = baca_sitemap()
    if lok is None:
        print("  GAGAL | sitemap.xml tidak ditemukan")
        return 1

    halaman = halaman_di_disk()
    terlewat = [h for h in halaman if f"/{h}/" not in lok]
    yatim = [u for u in lok if u != "/" and u.strip("/") not in halaman
             and not u.endswith(".html") and u.strip("/") not in KECUALI]

    if verbose:
        print(f"  halaman di disk : {len(halaman)}")
        print(f"  entri sitemap   : {len(lok)}")

    ok = True

    if terlewat:
        ok = False
        print(f"  GAGAL | {len(terlewat)} halaman ada di disk tapi TIDAK di sitemap.xml:")
        for h in terlewat:
            print(f"          - /{h}/   (live tapi tidak akan terindeks)")
        print("          Perbaikan: daftarkan di HALAMAN pada tools/pasang-seo.py,")
        print("          lalu jalankan tools/buat-gambar-og.py dan tools/pasang-seo.py.")
    elif verbose:
        print(f"  OK    | semua {len(halaman)} halaman terdaftar di sitemap")

    if yatim:
        # Bukan kegagalan: entri sitemap boleh menunjuk halaman .html tunggal
        # (mis. /beli/ yang punya index.html sendiri) atau URL kanonik lain.
        print(f"  CATAT | {len(yatim)} entri sitemap tanpa direktori padanan di disk:")
        for u in yatim[:8]:
            print(f"          - {u}")
        if len(yatim) > 8:
            print(f"          ... dan {len(yatim) - 8} lagi")

    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""Cek celah keyword: apakah sebuah frasa benar-benar belum ada di halaman live?

Kenapa ada: heartbeat perencanaan DUA KALI membuat tugas duplikat karena hanya memeriksa
daftar slug di sitemap.xml, bukan ISI halaman. Slug /simulasi-tryout/ tidak memuat kata
"aplikasi" atau "akademi", jadi celahnya tampak terbuka padahal isinya sudah menyasar.

Pakai:
    python3 tools/cek-celah-keyword.py "psikotes akademi militer"
    python3 tools/cek-celah-keyword.py --semua

Keluar dengan kode 0 bila frasa SUDAH ADA (bukan celah), 1 bila BELUM ADA (celah nyata).
"""
import argparse
import html
import re
import sys
import urllib.request

SITUS = "https://siappsikotes.my.id"
UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}


def ambil(url: str) -> str:
    # Cloudflare membalas 403 untuk User-Agent python-urllib default; UA peramban wajib.
    req = urllib.request.Request(url, headers=UA)
    return urllib.request.urlopen(req, timeout=25).read().decode("utf-8", "ignore")


def teks_halaman(url: str) -> str:
    h = ambil(url)
    h = re.sub(r"<script.*?</script>", " ", h, flags=re.S)
    h = re.sub(r"<style.*?</style>", " ", h, flags=re.S)
    t = re.sub(r"<[^>]+>", " ", h)
    return re.sub(r"\s+", " ", html.unescape(t)).lower()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("frasa", nargs="?", help="frasa yang dicari (huruf kecil/besar bebas)")
    ap.add_argument("--semua", action="store_true", help="cetak semua halaman yang memuat frasa")
    a = ap.parse_args()
    if not a.frasa:
        print("pakai: cek-celah-keyword.py \"<frasa>\" [--semua]")
        return 2

    frasa = a.frasa.strip().lower()
    peta = ambil(f"{SITUS}/sitemap.xml")
    urls = re.findall(r"<loc>([^<]+)</loc>", peta)
    if not urls:
        print("sitemap kosong / tidak terbaca", file=sys.stderr)
        return 2

    hasil = []
    for u in urls:
        try:
            n = teks_halaman(u).count(frasa)
        except Exception as e:
            print(f"  LEWAT {u} ({type(e).__name__})", file=sys.stderr)
            continue
        if n:
            hasil.append((n, u.replace(SITUS + "/", "")))

    hasil.sort(reverse=True)
    if hasil:
        if a.semua:
            for n, u in hasil:
                print(f"  {n}x  /{u}")
        else:
            n, u = hasil[0]
            print(f"SUDAH ADA ({n}x di /{u}) -> BUKAN celah, jangan buat tugas")
        return 0
    print(f"BELUM ADA di {len(urls)} halaman -> CELAH NYATA, boleh dibuatkan halaman")
    return 1


if __name__ == "__main__":
    sys.exit(main())

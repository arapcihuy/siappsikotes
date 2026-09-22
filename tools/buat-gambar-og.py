#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Kartu pratinjau (OG image) untuk setiap halaman publik SiapPsikotes.

Sebelum ini SEMUA halaman memakai satu berkas yang sama, /og-image.png: judul
pratinjau di WhatsApp/Facebook/X berbeda-beda, tetapi gambarnya selalu kartu
beranda. Tautan yang dibagikan orang ke grup WhatsApp karena itu tampil seperti
tautan ke beranda, bukan seperti halaman yang benar-benar dibuka.

Cara kerja: teks kartu diambil dari <meta property="og:title"> dan
<meta property="og:description"> halaman itu sendiri, jadi kartu tidak mungkin
menceritakan hal yang berbeda dari halamannya. Gambar dirender lokal dengan
Pillow - tanpa layanan gambar, tanpa akun, tanpa permintaan jaringan.

Pakai:
    python3 tools/buat-gambar-og.py             # tulis ulang semua kartu
    python3 tools/buat-gambar-og.py --periksa   # periksa saja (gerbang, tanpa menulis)

Keluaran: static/og/<slug>.png (1200x630) plus og-image.png di akar situs.
"""
import html
import importlib.util
import os
import re
import struct
import sys

try:                       # Pillow hanya perlu untuk MENULIS kartu, bukan untuk memeriksanya
    from PIL import Image, ImageDraw, ImageFilter, ImageFont
except ImportError:        # jadi gerbang/CI tetap bisa memeriksa tanpa memasang Pillow
    Image = ImageDraw = ImageFilter = ImageFont = None

AKAR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(AKAR)

UKURAN = (1200, 630)
LEBAR = 1032
X = 84

FONT_TEBAL = ['/System/Library/Fonts/Avenir Next.ttc',
              '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf']
FONT_KURUS = ['/System/Library/Fonts/Avenir Next.ttc',
              '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']
FONT_MONO = ['/System/Library/Fonts/Supplemental/Andale Mono.ttf',
             '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf']
FONT_NOMOR = ['/System/Library/Fonts/Avenir Next Condensed.ttc',
              '/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf']

LATAR = (6, 6, 11)
PUTIH = (245, 245, 247)
ABU = (161, 161, 170)
ABU2 = (120, 120, 130)
EMAS = (224, 184, 76)
BIRU = (64, 156, 255)

# (awalan slug, label kecil, warna aksen)
LABEL = [
    ('beranda', 'APLIKASI LATIHAN', EMAS),
    ('psikotes', 'ISI PAKET', EMAS),
    ('contoh', 'GRATIS DICOBA', EMAS),
    ('beli', 'HARGA & CARA BELI', EMAS),
    ('lisensi', 'UNTUK LEMBAGA', EMAS),
    ('mutu', 'BUKTI PEMERIKSAAN', EMAS),
    ('syarat', 'KETENTUAN', ABU2),
    ('privasi', 'KETENTUAN', ABU2),
]
LABEL_ARTIKEL = ('CONTOH SOAL', BIRU)
KAKI_KANAN = 'TANPA AKUN \u00b7 BISA OFFLINE'


def halaman():
    """Daftar halaman diambil dari tools/pasang-seo.py supaya tidak ada daftar kedua."""
    spesifikasi = importlib.util.spec_from_file_location('pasang_seo', 'tools/pasang-seo.py')
    modul = importlib.util.module_from_spec(spesifikasi)
    spesifikasi.loader.exec_module(modul)
    return modul.DOMAIN, modul.HALAMAN


def slug(jalur):
    nama = jalur.strip('/').replace('/', '-')
    return nama or 'beranda'


def bersih(teks):
    return html.unescape(re.sub(r'<[^>]+>', '', teks)).strip()


def cuplik(berkas, nama):
    """Ambil isi satu <meta property="og:nama"> milik halaman."""
    with open(berkas, encoding='utf-8') as f:
        isi = f.read()
    hasil = re.search(r'<meta property="og:%s" content="([^"]*)"' % nama, isi)
    return bersih(hasil.group(1)) if hasil else ''


def tanpa_merek(judul):
    return re.sub(r'\s*[\u2013\u2014|-]\s*SiapPsikotes\s*$', '', judul).strip()


def label_untuk(s):
    for awalan, teks, warna in LABEL:
        if s.startswith(awalan):
            return teks, warna
    return LABEL_ARTIKEL


def font(daftar, ukuran, indeks=0):
    for jalur in daftar:
        if os.path.exists(jalur):
            try:
                return ImageFont.truetype(jalur, ukuran, index=indeks)
            except Exception:
                continue
    print('GAGAL: tidak ada font yang bisa dipakai. Perlu salah satu dari:', daftar)
    sys.exit(2)


def bungkus(teks, fnt, lebar):
    """Bungkus teks jadi baris-baris yang muat."""
    baris, sekarang = [], ''
    for kata in teks.split():
        calon = (sekarang + ' ' + kata).strip()
        if fnt.getlength(calon) <= lebar or not sekarang:
            sekarang = calon
        else:
            baris.append(sekarang)
            sekarang = kata
    if sekarang:
        baris.append(sekarang)
    return baris


def berjarak(d, posisi, teks, fnt, warna, jarak):
    """Tulis teks dengan jarak antarhuruf (PIL belum punya letter-spacing)."""
    x, y = posisi
    for huruf in teks:
        d.text((x, y), huruf, font=fnt, fill=warna)
        x += fnt.getlength(huruf) + jarak


def pendar(ukuran, warna, pusat, radius, kekuatan):
    """Lapisan pendar lembut sebagai latar, bukan warna blok datar."""
    lapis = Image.new('RGB', ukuran, (0, 0, 0))
    d = ImageDraw.Draw(lapis)
    cx, cy = pusat
    d.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], fill=warna)
    lapis = lapis.filter(ImageFilter.GaussianBlur(radius // 2))
    return Image.blend(Image.new('RGB', ukuran, (0, 0, 0)), lapis, kekuatan)


def gambar_kartu(judul, ringkas, teks_label, aksen, nomor):
    kanvas = Image.new('RGB', UKURAN, LATAR)
    kanvas = Image.blend(kanvas, pendar(UKURAN, (60, 40, 8), (1500, -120), 620, 1.0), 0.55)
    kanvas = Image.blend(kanvas, pendar(UKURAN, (10, 40, 78), (-140, 760), 560, 1.0), 0.5)
    d = ImageDraw.Draw(kanvas, 'RGBA')

    # Nomor halaman sebagai tanda besar; satu-satunya elemen yang diingat dari kartu ini.
    d.text((1180, 640), nomor, font=font(FONT_NOMOR, 300), fill=aksen + (26,), anchor='rs')

    # Kisi halus: mengubah latar gelap kosong jadi bidang yang terukur.
    for x in range(0, UKURAN[0], 40):
        d.line([(x, 0), (x, UKURAN[1])], fill=(255, 255, 255, 7))
    for y in range(0, UKURAN[1], 40):
        d.line([(0, y), (UKURAN[0], y)], fill=(255, 255, 255, 7))

    berjarak(d, (X, 78), teks_label, font(FONT_MONO, 25), aksen, 4)
    d.rectangle([X, 124, X + 92, 128], fill=aksen)

    f_judul = font(FONT_TEBAL, 74)
    baris = bungkus(judul, f_judul, LEBAR)
    while len(baris) > 3 and f_judul.size > 46:
        f_judul = font(FONT_TEBAL, f_judul.size - 4)
        baris = bungkus(judul, f_judul, LEBAR)
    y = 186
    for b in baris[:3]:
        d.text((X, y), b, font=f_judul, fill=PUTIH)
        y += int(f_judul.size * 1.14)

    f_ringkas = font(FONT_KURUS, 29, 5)
    y += 14
    for b in bungkus(ringkas, f_ringkas, LEBAR)[:2]:
        d.text((X, y), b, font=f_ringkas, fill=ABU)
        y += 42

    d.rectangle([X, 540, X + 40, 543], fill=aksen)
    d.text((X, 566), 'siappsikotes.my.id', font=font(FONT_MONO, 24), fill=ABU2)
    d.text((1116, 566), KAKI_KANAN, font=font(FONT_MONO, 24), fill=ABU2, anchor='ra')
    return kanvas


def semua_kartu():
    _, daftar = halaman()
    keluaran = []
    for i, (berkas, jalur, _, _) in enumerate(daftar, start=1):
        if not os.path.exists(berkas):
            print('  LEWAT | berkas tidak ada:', berkas)
            continue
        s = slug(jalur)
        teks_label, aksen = label_untuk(s)
        keluaran.append((s, tanpa_merek(cuplik(berkas, 'title')),
                         cuplik(berkas, 'description'), teks_label, aksen, '%02d' % i))
    return keluaran


def tulis(periksa):
    if not periksa and Image is None:
        print('GAGAL: Pillow belum terpasang. Pasang dulu: pip install pillow')
        return 2
    tujuan = os.path.join('static', 'og')
    if not periksa:
        os.makedirs(tujuan, exist_ok=True)
    jumlah = 0
    for s, judul, ringkas, teks_label, aksen, nomor in semua_kartu():
        jalur = os.path.join(tujuan, s + '.png')
        if periksa:
            if not os.path.exists(jalur):
                print('  GAGAL | kartu belum dibuat:', jalur)
                return 1
            with open(jalur, 'rb') as f:
                kepala = f.read(24)
            if kepala[:8] != b'\x89PNG\r\n\x1a\n' or kepala[12:16] != b'IHDR':
                print('  GAGAL | bukan PNG yang sah:', jalur)
                return 1
            lebar, tinggi = struct.unpack('>II', kepala[16:24])
            if (lebar, tinggi) != UKURAN:
                print('  GAGAL | ukuran kartu salah:', jalur, (lebar, tinggi))
                return 1
            besar = os.path.getsize(jalur)
            if besar > 300 * 1024:
                print('  GAGAL | kartu terlalu besar (batas 300 KB):', jalur, besar)
                return 1
            jumlah += 1
            continue
        kartu = gambar_kartu(judul, ringkas, teks_label, aksen, nomor)
        kartu.save(jalur, optimize=True)
        if s == 'beranda':
            kartu.save('og-image.png', optimize=True)
        jumlah += 1
        print('  OK    | %s %d KB - %s' % (jalur, os.path.getsize(jalur) // 1024, judul[:48]))
    if periksa and not os.path.exists('og-image.png'):
        print('  GAGAL | og-image.png akar situs hilang')
        return 1
    print('  OK    | %d kartu %s' % (jumlah, 'diperiksa' if periksa else 'dibuat'))
    return 0


if __name__ == '__main__':
    sys.exit(tulis('--periksa' in sys.argv))

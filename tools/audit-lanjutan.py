#!/usr/bin/env python3
"""Pemeriksaan lanjutan: berkas aset, daftar service worker, angka halaman /mutu/,
teks klaim di aplikasi, dan jalur pemulihan kode akses."""
import os
import re
import sys
import urllib.request
import urllib.error

DASAR = 'http://siappsikotes.my.id'
AKAR = '/Users/mac/tni-belajar'


def ambil(url, metode='GET'):
    req = urllib.request.Request(url, method=metode, headers={'User-Agent': 'audit-hermes/1.0'})
    try:
        with urllib.request.urlopen(req, timeout=25) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, b''
    except Exception:
        return 0, b''


print('=== 1. Berkas aset penting di situs live ===')
aset = ['static/css/style.css', 'static/js/app.js', 'static/js/akses.js', 'static/js/akun-google.js',
        'static/js/fitur11.js', 'static/js/fitur13.js', 'static/icons/favicon-32.png',
        'static/icons/icon-192.png', 'static/icons/icon-512.png',
        'static/icons/apple-touch-icon-180.png', 'static/icons/icon-maskable-512.png',
        'og-image.png', 'data/soal-index.js', 'data/soal-tkw.js']
gagal = []
for a in aset:
    kode, isi = ambil('%s/%s' % (DASAR, a), 'HEAD')
    print('  %-5s %-40s %s' % ('OK  ' if kode == 200 else 'GAGAL', '/' + a, kode))
    if kode != 200:
        gagal.append(a)

print()
print('=== 2. Daftar berkas di sw.js (setelah ?v= dibuang) ===')
isi = open(os.path.join(AKAR, 'sw.js'), encoding='utf-8').read()
blok = re.search(r'const FILES = \[(.*?)\]', isi, re.S)
berkas = re.findall(r"'([^']+)'", blok.group(1)) if blok else []
bersih = [b.split('?')[0].lstrip('./') for b in berkas]
hilang = [b for b in bersih if b not in ('', './') and not os.path.exists(os.path.join(AKAR, b))]
print('  jumlah berkas : %d' % len(berkas))
print('  tidak ada di repo : %s' % (hilang if hilang else 'tidak ada'))

print()
print('=== 3. Angka di /mutu/ vs kenyataan ===')
mutu = open(os.path.join(AKAR, 'mutu', 'index.html'), encoding='utf-8').read()
for angka in ['1.348', '154', '11', '50']:
    print('  angka %-5s muncul %d kali di /mutu/' % (angka, mutu.count(angka)))
print('  (kenyataan: 1.348 soal, 154 uji fitur, 11 butir mutu, 50 uji tampilan)')

print()
print('=== 4. Kata "gratis" di halaman aplikasi (index.html) ===')
idx = open(os.path.join(AKAR, 'index.html'), encoding='utf-8').read()
for m in re.finditer(r'[^<>]{0,60}gratis[^<>]{0,60}', idx, re.I):
    print('  -', m.group(0).strip()[:110])

print()
print('=== 5. Jalur pemulihan kode akses & lapor soal di aplikasi ===')
for nama, berkas_js in [('lapor soal', ['static/js/fitur12.js', 'static/js/fitur14.js', 'static/js/fitur11.js']),
                        ('pulihkan kode', ['static/js/akses.js'])]:
    for b in berkas_js:
        jalur = os.path.join(AKAR, b)
        if not os.path.exists(jalur):
            continue
        t = open(jalur, encoding='utf-8').read()
        ketemu = re.findall(r"window\.(laporkan\w*|lapor\w*|pulihkan\w*)\s*=", t)
        if ketemu:
            print('  %-14s di %-24s -> %s' % (nama, b, ketemu))
print()
print('=== 6. Apakah kode hilang diarahkan ke WhatsApp/email di dalam aplikasi ===')
for b in ['static/js/akses.js', 'static/js/fitur11.js']:
    t = open(os.path.join(AKAR, b), encoding='utf-8').read()
    ada_wa = 'wa.me' in t or 'whatsapp' in t.lower()
    ada_surel = 'surel' in t.lower() or 'mailto' in t
    print('  %-24s sebut WhatsApp: %-5s  sebut email/surel: %s' % (b, ada_wa, ada_surel))

print()
print('=== ringkasan aset gagal: %s' % (gagal if gagal else 'tidak ada'))

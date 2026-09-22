#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Sisipkan salinan statis soal /contoh/ supaya terbaca tanpa JavaScript.

Masalah yang diperbaiki: /contoh/ menggambar 40 soalnya dengan JavaScript, jadi
mesin pencari, pembaca layar, dan pengunjung tanpa skrip hanya melihat kerangka
halaman (sekitar 1,9 KB teks). Padahal halaman itu pintu masuk termurah: satu-
satunya isi produk yang gratis.

Alat ini membaca window.CONTOH_SOAL dari contoh/index.html (bukan dari data/*.js)
supaya salinan statis selalu sama persis dengan 40 soal yang benar-benar terbit,
lalu menulis soal + pilihan + kunci + pembahasan di dalam <noscript> pada
#contoh-daftar. Pengunjung dengan JavaScript tetap memakai kuis interaktif -
skrip halaman mengosongkan wadah itu begitu jalan.

Jalankan ulang setiap kali contoh/index.html dibuat ulang (termasuk oleh
tools/buat-contoh.py) atau bila jumlah soalnya berubah. Gerbang
tools/uji-tampilan-pendukung.py memeriksa hasilnya tanpa JavaScript, jadi salinan
yang hilang ketahuan sebelum terkirim.

Pakai:  /usr/bin/python3 tools/sisip-contoh-statis.py [berkas]
        (tanpa argumen: contoh/index.html; alat ini juga dipanggil otomatis
         sebagai langkah terakhir tools/buat-contoh.py supaya salinan statis
         tidak bisa hilang saat halaman dibuat ulang)
"""
import html
import json
import os
import re
import sys

AKAR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HALAMAN = os.path.join(AKAR, 'contoh', 'index.html')
WADAH = '<div id="contoh-daftar"></div>'

GAWAL_GAYA = ('<!-- statis-gaya:mulai -->', '<!-- statis-gaya:selesai -->')
GAWAL_BLOK = ('<!-- statis-soal:mulai -->', '<!-- statis-soal:selesai -->')

GAYA = '''<!-- statis-gaya:mulai -->
<style>
  .statis-pilih { margin:0 0 14px; padding-left:22px; }
  .statis-pilih li { margin:0 0 6px; }
  .statis-kunci { font-weight:700; color:var(--ok); }
</style>
<!-- statis-gaya:selesai -->'''


def baca_soal(isi):
    m = re.search(r'window\.CONTOH_SOAL\s*=\s*(\[.*?\]);', isi, re.S)
    if not m:
        raise SystemExit('window.CONTOH_SOAL tidak ditemukan di %s' % HALAMAN)
    return json.loads(m.group(1))


def kartu(soal, nomor, total):
    abjad = 'ABCD'
    butir = []
    for i, teks in enumerate(soal['p']):
        tanda = ' <span class="statis-kunci">(jawaban)</span>' if i == soal['j'] else ''
        butir.append('        <li>%s. %s%s</li>'
                     % (abjad[i] if i < len(abjad) else str(i + 1), html.escape(teks), tanda))
    return '''    <article class="kartu-soal">
      <div class="kartu-kepala"><span class="kartu-jenis">%s</span><span class="kartu-nomor">%d/%d</span></div>
      <h2 class="kartu-tanya">%s</h2>
      <ul class="statis-pilih">
%s
      </ul>
      <div class="kartu-bahas"><p class="bahas-judul">Pembahasan</p><p class="bahas-isi">%s</p></div>
    </article>''' % (
        html.escape(str(soal.get('n', ''))), nomor, total,
        html.escape(str(soal['t'])), '\n'.join(butir), html.escape(str(soal['b'])),
    )


def blok(soal):
    isi = '\n'.join(kartu(s, i + 1, len(soal)) for i, s in enumerate(soal))
    return ('%s\n<noscript>\n<!-- Salinan statis untuk mesin pencari dan pengunjung tanpa\n'
            '     JavaScript. Dibuat tools/sisip-contoh-statis.py; jangan disunting tangan. -->\n'
            '%s\n</noscript>\n%s' % (GAWAL_BLOK[0], isi, GAWAL_BLOK[1]))


def ganti_antara(isi, gawal, baru):
    """Ganti isi di antara sepasang penanda. None bila penandanya belum ada."""
    if gawal[0] not in isi or gawal[1] not in isi:
        return None
    pola = re.compile(re.escape(gawal[0]) + '.*?' + re.escape(gawal[1]), re.S)
    return pola.sub(lambda _: baru, isi, count=1)


def main(jalur=HALAMAN):
    isi = open(jalur, encoding='utf-8').read()
    soal = baca_soal(isi)
    if len(soal) < 40:
        print('GAGAL: hanya %d soal di window.CONTOH_SOAL, seharusnya >= 40' % len(soal))
        return 1
    cacat = [s['t'][:40] for s in soal
             if not s.get('t') or not s.get('b') or not (0 <= int(s['j']) < len(s['p']))]
    if cacat:
        print('GAGAL: soal cacat: %s' % cacat[:3])
        return 1

    lama = len(isi)
    gaya = ganti_antara(isi, GAWAL_GAYA, GAYA)
    if gaya is None:
        potong = isi.rindex('</style>') + len('</style>')
        gaya = isi[:potong] + '\n' + GAYA + isi[potong:]
    isi = gaya

    baru = blok(soal)
    soal_blok = ganti_antara(isi, GAWAL_BLOK, baru)
    if soal_blok is None:
        if WADAH not in isi:
            print('GAGAL: %s tidak ditemukan di %s' % (WADAH, jalur))
            return 1
        soal_blok = isi.replace(WADAH, '<div id="contoh-daftar">\n' + baru + '\n</div>', 1)
    isi = soal_blok

    open(jalur, 'w', encoding='utf-8').write(isi)
    print('soal statis   : %d' % len(soal))
    print('berkas        : %s' % jalur)
    print('ukuran        : %.1f KB -> %.1f KB' % (lama / 1024.0, len(isi) / 1024.0))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else HALAMAN))

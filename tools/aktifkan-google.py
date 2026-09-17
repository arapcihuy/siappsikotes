#!/usr/bin/env python3
"""Nyalakan 'Masuk dengan Google' + ruang akun pengguna di server (tanpa Google Drive).

Latar: proyek Google Cloud "SiapPsikotes" (id: handy-geography-415619) sudah disiapkan lewat gcloud.
Yang tersisa hanya OAuth Client ID, karena Google tidak menyediakan
pembuatan client lewat terminal - harus lewat konsol (sekali klik oleh pemilik).

Contoh:
  /usr/bin/python3 tools/aktifkan-google.py --periksa
  /usr/bin/python3 tools/aktifkan-google.py --client-id 123456789012-abc...apps.googleusercontent.com --kirim
"""
import argparse
import os
import re
import subprocess
import sys

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROYEK = 'handy-geography-415619'
CONSOLE = 'https://console.cloud.google.com/auth/clients?project=' + PROYEK


def baca(rel):
    return open(os.path.join(APP, rel), encoding='utf-8').read()


def tulis(rel, isi):
    open(os.path.join(APP, rel), 'w', encoding='utf-8').write(isi)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--client-id', default='')
    ap.add_argument('--kirim', action='store_true', help='jalankan gerbang lengkap lalu kirim')
    ap.add_argument('--periksa', action='store_true', help='tampilkan keadaan sekarang')
    a = ap.parse_args()

    s = baca('static/js/akun-google.js')
    m = re.search(r"clientId:\s*'([^']*)'", s)
    aktif = re.search(r"aktif:\s*(true|false)", s)
    print('=== keadaan sekarang ===')
    print('  aktif     :', aktif.group(1) if aktif else '?')
    print('  clientId  :', (m.group(1) or '(kosong)') if m else '?')
    print('  proyek    :', PROYEK, '| Google Sign-In: identitas saja (tanpa Drive)')
    if a.periksa or not a.client_id:
        print('\n=== yang perlu kamu klik SEKALI di konsol Google ===')
        print('  1. Buka:', CONSOLE)
        print('  2. Jika diminta "Get started": isi App name = SiapPsikotes,')
        print('     User support email = rasyidahmad180@gmail.com, Audience = External.')
        print('  3. Tombol CREATE CLIENT -> Application type = Web application,')
        print('     Name = SiapPsikotes Web.')
        print('  4. Authorized JavaScript origins: https://arapcihuy.github.io')
        print('     (Authorized redirect URIs: biarkan KOSONG)')
        print('  5. CREATE -> salin Client ID -> jalankan:')
        print('     /usr/bin/python3 tools/aktifkan-google.py --client-id "<Client ID>" --kirim')
        print('\nTidak ada yang dibayar: Google Sign-In tidak berbiaya pada skala ini.')
        return 0

    cid = a.client_id.strip()
    if not re.match(r'^[0-9]{6,}-[a-z0-9]+\.apps\.googleusercontent\.com$', cid):
        print('BENTUK CLIENT ID TIDAK DIKENALI:', cid)
        print('Seharusnya berakhiran .apps.googleusercontent.com (mis. 123456789012-abcd....apps.googleusercontent.com)')
        print('Salin ulang dari konsol; jangan diketik manual.')
        return 2

    # 1) nyalakan modul Google
    s = re.sub(r"clientId:\s*'[^']*'", "clientId: '%s'" % cid, s)
    s = re.sub(r"aktif:\s*(true|false)", "aktif: true", s, count=1)
    tulis('static/js/akun-google.js', s)
    print('modul Google dinyalakan dengan client id:', cid[:24] + '...')

    # 2) selaraskan halaman hukum: 'belum aktif' -> aktif
    for rel in ('privasi/index.html', 'syarat/index.html'):
        t = baca(rel)
        lama = t
        t = t.replace('(opsional, belum aktif)', '(opsional)')
        t = t.replace('Fitur Masuk dengan Google sedang kami siapkan dan belum bisa dipakai saat ini. ',
                      'Fitur Masuk dengan Google sudah bisa dipakai. ')
        t = t.replace('Selama fitur itu belum aktif, tidak ada data yang dikirim ke Google lewat aplikasi ini, dan kami akan mengumumkan di halaman ini bila fitur tersebut diaktifkan. ',
                      'Sampai kamu sendiri memakainya, tidak ada data yang dikirim ke Google lewat aplikasi ini. ')
        t = t.replace('Sampai fitur itu diaktifkan, tidak ada data yang dikirim ke Google lewat aplikasi ini, dan kami akan mengumumkan di halaman ini saat fitur tersebut siap. ',
                      'Sampai kamu sendiri memakainya, tidak ada data yang dikirim ke Google lewat aplikasi ini. ')
        if t != lama:
            tulis(rel, t)
            print('  halaman diselaraskan:', rel)
        else:
            print('  (tidak ada perubahan teks di', rel + ')')

    if a.kirim:
        print('\nmenjalankan gerbang lengkap lalu mengirim...')
        r = subprocess.run(['bash', 'tools/kirim.sh', '/tmp/pesan-google-aktif.txt'], cwd=APP, capture_output=True, text=True)
        print((r.stdout or '')[-800:])
        return r.returncode
    print('\nLangkah berikutnya: uji di aplikasi (menu Ruang belajar -> Masuk dengan Google), lalu:')
    print('  bash tools/kirim.sh /tmp/pesan.txt')
    return 0


if __name__ == '__main__':
    sys.exit(main())

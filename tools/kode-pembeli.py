#!/usr/bin/env python3
"""Buat kode akses untuk pembeli + pesan balasan siap kirim.

Cara pakai (saat ada uang masuk, lihat nominal uniknya):
  /usr/bin/python3 tools/kode-pembeli.py --rujukan SP-164 --nominal 39164
  /usr/bin/python3 tools/kode-pembeli.py --rujukan SP-164 --nominal 39164 --salin

Hasilnya: satu kode akses sah + pesan balasan yang bisa langsung ditempel ke surel/WhatsApp pembeli,
dan catatan penjualan yang ditambahkan ke ~/pk-bisnis/PENJUALAN.csv supaya pencatatanmu rapi.
"""
import argparse
import csv
import datetime
import os
import re
import subprocess
import sys

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CATATAN = os.path.expanduser('~/pk-bisnis/PENJUALAN.csv')


def buat_kode(isi):
    r = subprocess.run(['/usr/bin/python3', os.path.join(APP, 'tools', 'buat-kode.py'),
                        '--isi', isi, '--jumlah', '1'], capture_output=True, text=True)
    m = re.search(r'SP[A-Z0-9]{6,}', r.stdout or '')
    return m.group(0) if m else ''


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--rujukan', required=True, help='kode rujukan pembeli, mis. SP-164')
    ap.add_argument('--nominal', default='', help='nominal yang masuk, mis. 39164')
    ap.add_argument('--nama', default='', help='nama pembeli (bila diketahui)')
    ap.add_argument('--salin', action='store_true', help='coba salin pesan ke papan klip')
    a = ap.parse_args()

    rujukan = a.rujukan.strip().upper()
    if not re.match(r'^SP-[0-9]{3}$', rujukan):
        print('Kode rujukan seharusnya berformat SP-XXX (tiga angka), mis. SP-164.')
        return 2

    # isi kode memuat rujukan -> pemilik bisa menelusuri siapa pembelinya
    isi = ('P' + rujukan.replace('-', '') + datetime.datetime.now().strftime('%d%m%y'))
    kode = buat_kode(isi)
    if not kode:
        print('Gagal membuat kode. Periksa tools/buat-kode.py.')
        return 1

    nominal = a.nominal.strip()
    pesan = (
        'Terima kasih, pembayaranmu sudah kami terima.\n\n'
        'Kode aksesmu: %s\n\n'
        'Cara pakai (1 menit):\n'
        '1. Buka https://siappsikotes.my.id/\n'
        '2. Pada layar "Buka dengan kode akses", tempel kode di atas.\n'
        '3. Seluruh materi terbuka: 1.348 soal, semua modul, pembahasan, dan Laporan Lengkap.\n\n'
        'Simpan kode ini. Kode yang sama juga membuka aplikasi di perangkat lain, dan bisa dipakai '
        'berulang tanpa batas pada perangkatmu. Bila ada kendala, balas pesan ini.'
        % kode)

    print('=== KODE AKSES ===')
    print('  rujukan :', rujukan, '| nominal:', nominal or '-', '| nama:', a.nama or '-')
    print('  kode    :', kode)
    print()
    print('=== PESAN BALASAN (siap tempel) ===')
    print(pesan)

    # catat penjualan
    baru = not os.path.exists(CATATAN)
    try:
        os.makedirs(os.path.dirname(CATATAN), exist_ok=True)
        with open(CATATAN, 'a', newline='', encoding='utf-8') as f:
            w = csv.writer(f)
            if baru:
                w.writerow(['tanggal', 'rujukan', 'nominal', 'nama', 'kode', 'produk'])
            w.writerow([datetime.date.today().isoformat(), rujukan, nominal, a.nama,
                        kode, 'Akses penuh SiapPsikotes + Laporan Lengkap'])
        print('\ncatatan penjualan ditambahkan ke', CATATAN)
    except Exception as e:
        print('\ngagal mencatat penjualan:', e)

    if a.salin:
        try:
            subprocess.run('pbcopy', input=pesan, text=True, shell=True, check=False)
            print('pesan disalin ke papan klip (siap tempel)')
        except Exception:
            pass
    return 0


if __name__ == '__main__':
    sys.exit(main())

#!/usr/bin/env python3
"""Jalur penerbitan kode akses SiapPsikotes (sisi pemilik, sisi server).

Mengapa alat ini ada
--------------------
Sidik 4 huruf pada kode dihitung dari kunci yang ikut terkirim ke peramban
(static/js/fitur11.js, tools/buat-kode.py), jadi kode ber-sidik benar bisa dibuat
siapa pun tanpa membayar. Karena itu API hanya menerima kode yang TERBIT di tabel
`kode_terbit`, dan tabel itu hanya boleh terisi dari setoran yang benar-benar masuk.

Alat ini adalah jalur penerbitannya:
  1. pemilik melihat uang masuk (QRIS / transfer / e-wallet),
  2. pemilik mencatat rujukan + nominal setoran di sini,
  3. barulah kode dibuat (oleh server) dan dicatat sebagai TERBIT + LUNAS.

Nominal yang tercatat di pembelian pembeli diambil dari catatan setoran INI, bukan dari
angka yang dikirim peramban pembeli.

Pakai
-----
  # kode baru untuk setoran yang baru masuk
  python3 tools/terbitkan-kode.py --rujukan SP-594 --nominal 39594

  # beberapa sekaligus (mis. satu pesanan berisi 3 kode)
  python3 tools/terbitkan-kode.py --rujukan SP-612 --nominal 39000 --jumlah 3

  # kode yang TERLANJUR dijual sebelum tabel ini ada: daftarkan, jangan dibuang
  python3 tools/terbitkan-kode.py --kode SP2609RP013B02 --rujukan SP-500 --nominal 39000

  # lihat catatan terbit
  python3 tools/terbitkan-kode.py --daftar

  # coba dulu di database lokal (tanpa menyentuh produksi)
  python3 tools/terbitkan-kode.py --rujukan UJI --nominal 39000 --lokal

Catatan: nilai yang ditulis ke SQL sudah divalidasi ketat (huruf/angka/dash saja) supaya
tidak ada teks yang bisa merusak kueri. Tidak ada kunci rahasia di berkas ini.
"""
import argparse
import datetime
import hashlib
import os
import re
import subprocess
import sys

AKAR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB = 'siappsikotes-db'
WRANGLER = os.path.expanduser('~/.local/bin/wrangler')
if not os.path.exists(WRANGLER):
    WRANGLER = 'wrangler'

sys.path.insert(0, os.path.join(AKAR, 'tools'))
from importlib import util as _util

_spec = _util.spec_from_file_location('buat_kode', os.path.join(AKAR, 'tools', 'buat-kode.py'))
buat_kode_mod = _util.module_from_spec(_spec)
_spec.loader.exec_module(buat_kode_mod)


def hash_kode(kode: str) -> str:
    """HARUS sama dengan hashKodeTerbit di server/src/index.js."""
    return hashlib.sha256(('kodet:' + kode.upper()).encode('utf-8')).hexdigest()


def bersih_kode(kode: str) -> str:
    return ''.join(c for c in str(kode).upper() if c.isalnum())


def aman_teks(t: str, batas: int = 40) -> str:
    """Buang apa pun yang bukan huruf/angka/spasi/-/./:/@/_, lalu potong."""
    return re.sub(r'[^A-Za-z0-9 .:/@_-]', '', str(t))[:batas]


def jalankan_sql(sql: str, lokal: bool, config: str = '') -> tuple:
    perintah = [WRANGLER, 'd1', 'execute', DB, '--command', sql]
    perintah.append('--local' if lokal else '--remote')
    if config:
        perintah += ['--config', config]
    r = subprocess.run(perintah, cwd=AKAR, capture_output=True, text=True, timeout=180)
    return r.returncode, (r.stdout or '') + (r.stderr or '')


def simpan(kode: str, rujukan: str, nominal: int, lokal: bool, config: str = '') -> bool:
    waktu = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')
    sql = (
        "INSERT INTO kode_terbit (kode_hash, kode_akhir, terbit, dibayar, rujukan, nominal, asal) "
        "VALUES ('%s', '%s', '%s', '%s', '%s', %d, 'alat-pemilik') "
        "ON CONFLICT(kode_hash) DO UPDATE SET dibayar = excluded.dibayar, "
        "rujukan = excluded.rujukan, nominal = excluded.nominal;"
        % (hash_kode(kode), kode[-6:], waktu, waktu, rujukan, nominal)
    )
    rc, kel = jalankan_sql(sql, lokal, config)
    if rc != 0:
        print('GAGAL mencatat kode ke database (%s):' % ('lokal' if lokal else 'produksi'))
        print('  ' + kel.strip()[-600:])
        return False
    return True


def daftar(lokal: bool, config: str = '') -> int:
    sql = ('SELECT kode_akhir, terbit, dibayar, rujukan, nominal, asal FROM kode_terbit '
           'ORDER BY terbit DESC LIMIT 50;')
    rc, kel = jalankan_sql(sql, lokal, config)
    if rc != 0:
        print('GAGAL membaca daftar:')
        print('  ' + kel.strip()[-600:])
        return 1
    print(kel.strip()[-4000:])
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--rujukan', default='', help='rujukan setoran, mis. SP-594 atau no. transfer')
    ap.add_argument('--nominal', type=int, default=0, help='nominal setoran yang benar-benar masuk (rupiah)')
    ap.add_argument('--kode', default='', help='daftarkan kode yang sudah dijual (tanpa membuat kode baru)')
    ap.add_argument('--jumlah', type=int, default=1, help='banyak kode yang dibuat untuk satu setoran')
    ap.add_argument('--lokal', action='store_true', help='tulis ke database D1 lokal (untuk uji)')
    ap.add_argument('--daftar', action='store_true', help='tampilkan catatan kode terbit')
    ap.add_argument('--config', default='', help='berkas wrangler.toml lain (untuk uji lokal)')
    a = ap.parse_args()

    if a.daftar:
        return daftar(a.lokal, a.config)

    rujukan = aman_teks(a.rujukan)
    if not rujukan:
        print('rujukan setoran wajib diisi (--rujukan); tanpa itu kode tidak bisa dipertanggungjawabkan.')
        return 2
    if a.nominal <= 0:
        print('nominal setoran wajib diisi dan lebih dari nol (--nominal); '
              'kode tidak boleh terbit dari angka kiriman peramban.')
        return 2

    if a.kode:
        kode = bersih_kode(a.kode)
        if not buat_kode_mod.periksa(kode):
            print('kode %s tidak lolos pemeriksaan sidik; periksa penulisannya.' % kode)
            return 2
        if not simpan(kode, rujukan, a.nominal, a.lokal, a.config):
            return 1
        print('kode lama didaftarkan sebagai lunas: %s (rujukan %s, Rp %s)'
              % (kode, rujukan, format(a.nominal, ',d').replace(',', '.')))
        print('  ARTI: kode ini sekarang berlaku di /api/ruang/masuk.')
        return 0

    jumlah = max(min(a.jumlah, 50), 1)
    dibuat = []
    for i in range(jumlah):
        # Isi dibuat acak, tidak diturunkan dari rujukan: kode tidak boleh bisa ditebak
        # dari nomor pesanan, dan satu setoran tidak boleh menghasilkan kode yang sama.
        isi = '%s%s' % (datetime.date.today().strftime('%y%m%d'),
                        hashlib.sha256(('%s|%s|%s' % (rujukan, time_isi(), i)).encode()).hexdigest()[:12].upper())
        kode = buat_kode_mod.buat_kode(isi)
        if not buat_kode_mod.periksa(kode):
            print('GAGAL memeriksa kode buatan sendiri:', kode)
            return 1
        if not simpan(kode, rujukan, a.nominal, a.lokal, a.config):
            return 1
        dibuat.append(kode)

    tujuan = 'lokal' if a.lokal else 'produksi'
    print('=== %d kode terbit (%s) ===' % (len(dibuat), tujuan))
    print('rujukan setoran :', rujukan)
    print('nominal setoran : Rp %s' % format(a.nominal, ',d').replace(',', '.'))
    for k in dibuat:
        print('  ', k)
    print('Berikan kode di atas kepada pembeli. Jangan tulis kodenya ke berkas repo:')
    print('yang disimpan server hanya hash-nya, dan kode cukup dikirim lewat WhatsApp/surel.')
    return 0


def time_isi() -> str:
    return datetime.datetime.now().strftime('%Y%m%d%H%M%S%f')


if __name__ == '__main__':
    sys.exit(main())

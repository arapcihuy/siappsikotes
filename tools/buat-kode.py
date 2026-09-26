#!/usr/bin/env python3
"""Pembuat kode akses Laporan Lengkap SiapPsikotes.

Kode dipakai untuk membuka laporan berbayar TANPA server: pemilik menjual kode lewat
marketplace/QRIS, pembeli menempelkan kode di aplikasi, aplikasi memeriksa sidik jarinya.

Format kode:  SP + <isi> + <sidik 4 huruf/angka>
Contoh:       SP2609RP01K7Q2

Isi kode bebas (dipakai pemilik untuk menandai pesanan, mis. tanggal + nomor urut),
asalkan huruf/angka saja. Sidik dihitung dengan algoritma yang SAMA dengan aplikasi
(static/js/fitur11.js, fungsi sidikKode).

CATATAN JUJUR (diperbarui 26 September 2026): kunci rahasia memang bisa dibaca orang yang
tekun, dan itu sudah terjadi konsekuensinya. Pemeriksaan kini dipindah ke server: kode hanya
berlaku bila TERBIT di tabel `kode_terbit` (lihat server/src/index.js). Alat ini sekarang hanya
membuat ISI kode (huruf/angka + sidik 4 huruf yang benar) dan tidak lagi cukup untuk membuka
aplikasi di produksi. Jalur penerbitan yang sah: tools/terbitkan-kode.py, yang mencatat dulu
rujukan + nominal setoran.

Pakai:
  python3 tools/buat-kode.py                     # 10 isi kode berpenanda hari ini
  python3 tools/buat-kode.py --jumlah 50         # 50 isi kode
  python3 tools/buat-kode.py --isi 2609RP01      # penanda khusus
  python3 tools/buat-kode.py --periksa SP2609RP01K7Q2   # uji satu kode
"""
import argparse
import datetime
import os
import sys

KUNCI = 'siap|psikotes|2026|kode'   # HARUS sama dengan KUNCI_KODE di static/js/fitur11.js


def sidik(isi: str) -> str:
    """Sidik 4 karakter (FNV-1a 32-bit); HARUS sama persis dengan static/js/fitur11.js."""
    h = 2166136261
    s = '%s#%s' % (isi, KUNCI)
    for ch in s:
        h ^= ord(ch)
        h = (h * 16777619) & 0xFFFFFFFF
    pos = h % 1679616                    # 36^4
    abjad = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    hasil = ''
    while pos > 0:
        hasil = abjad[pos % 36] + hasil
        pos //= 36
    return hasil.rjust(4, '0')


def buat_kode(isi: str) -> str:
    bersih = ''.join(c for c in isi.upper() if c.isalnum())
    return 'SP' + bersih + sidik(bersih)


def periksa(kode: str) -> bool:
    b = ''.join(c for c in kode.upper() if c.isalnum())
    if not b.startswith('SP') or len(b) < 8:
        return False
    isi, cek = b[2:-4], b[-4:]
    return sidik(isi) == cek


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--jumlah', type=int, default=10)
    ap.add_argument('--isi', default='')
    ap.add_argument('--periksa', default='')
    ap.add_argument('--keluaran', default='')
    args = ap.parse_args()

    if args.periksa:
        sah = periksa(args.periksa)
        print('kode %s -> %s' % (args.periksa, 'SAH' if sah else 'TIDAK SAH'))
        return 0 if sah else 1

    tanggal = datetime.date.today().strftime('%y%m%d')
    dasar = args.isi.upper() if args.isi else tanggal + 'RP'
    kode = [buat_kode('%s%02d' % (dasar, i + 1)) for i in range(args.jumlah)]

    # uji diri: setiap kode yang dibuat harus lolos pemeriksaan
    gagal = [k for k in kode if not periksa(k)]
    if gagal:
        print('GAGAL memeriksa kode buatan sendiri:', gagal)
        return 1

    keluaran = args.keluaran or os.path.expanduser('~/pk-bisnis/kode-akses-%s.txt' % tanggal)
    with open(keluaran, 'w', encoding='utf-8') as f:
        f.write('# Kode akses Laporan Lengkap SiapPsikotes\n')
        f.write('# Dibuat: %s\n' % datetime.datetime.now().strftime('%d %B %Y %H:%M'))
        f.write('# Cara pakai: pembeli membuka aplikasi -> Laporan -> tempel kode -> Buka laporan\n')
        f.write('# Catatan: berkas ini hanya berisi ISI kode. Untuk membuat kode yang BERLAKU,\n')
        f.write('#          catat setorannya dulu: python3 tools/terbitkan-kode.py --rujukan ... --nominal ...\n\n')
        for k in kode:
            f.write(k + '\n')
    print('dibuat %d kode, semua lolos uji pemeriksaan' % len(kode))
    print('berkas: %s' % keluaran)
    print('contoh: %s' % kode[0])
    return 0


if __name__ == '__main__':
    sys.exit(main())

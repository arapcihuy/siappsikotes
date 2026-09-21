"""Aktifkan penerimaan pembayaran: QRIS (gambar) ATAU nomor rekening/e-wallet.

Kegunaan: begitu pemilik memberi tujuan uangnya (satu baris), pembayaran langsung hidup.
Pemilik TIDAK perlu menyentuh kode sama sekali.

Contoh:
  /usr/bin/python3 tools/pasang-bayar.py --rekening "DANA 0812xxxxxxx a/n Rasyid" --whatsapp 62812xxxxxxx
  /usr/bin/python3 tools/pasang-bayar.py --qris ~/Desktop/qris.png --whatsapp 62812xxxxxxx
  /usr/bin/python3 tools/pasang-bayar.py --periksa
"""
import argparse
import os
import re
import shutil
import subprocess
import sys

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FITUR11 = os.path.join(APP, 'static', 'js', 'fitur11.js')
BELI = os.path.join(APP, 'beli', 'index.html')
GAMBAR_TUJUAN = os.path.join(APP, 'static', 'img', 'qris-bayar.png')


def nomor_di_beli():
    """Nomor WhatsApp yang tertulis di tombol /beli/, atau '' bila tidak ada."""
    try:
        isi = open(BELI, encoding='utf-8').read()
    except OSError:
        return ''
    m = re.search(r'https://wa\.me/(\d+)', isi)
    return m.group(1) if m else ''


def samakan_beli(nomor):
    """Samakan nomor di tombol /beli/. Tombol itu ditulis di HTML supaya tetap menuju
    WhatsApp walau skrip halaman gagal; karena itu nomornya harus ikut berubah di sini."""
    isi = open(BELI, encoding='utf-8').read()
    baru, n = re.subn(r'(https://wa\.me/)\d+', r'\g<1>' + nomor, isi)
    if n:
        open(BELI, 'w', encoding='utf-8').write(baru)
    return n


def baca():
    return open(FITUR11, encoding='utf-8').read()


def tulis(t):
    open(FITUR11, 'w', encoding='utf-8').write(t)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--rekening', default='', help='mis. "DANA 0812xxxxxxx a/n Rasyid" atau "BCA 1234567890"')
    ap.add_argument('--whatsapp', default='', help='nomor WA penerima bukti, format 62812xxxxxxx')
    ap.add_argument('--surel', default='', help='surel penerima bukti (bila tanpa WhatsApp)')
    ap.add_argument('--qris', default='', help='berkas gambar QRIS milik pemilik (png/jpg)')
    ap.add_argument('--harga', default='Rp 39.000')
    ap.add_argument('--matikan', action='store_true', help='kembalikan ke belum aktif')
    ap.add_argument('--periksa', action='store_true')
    ap.add_argument('--kirim', action='store_true')
    a = ap.parse_args()

    t = baca()

    if a.periksa or (not a.matikan and not a.rekening and not a.qris and not a.whatsapp and not a.surel):
        m = re.search(r"aktif:\s*(true|false)", t)
        rec = re.search(r"rekening:\s*'([^']*)'", t)
        wa = re.search(r"whatsapp:\s*'([^']*)'", t)
        qr = re.search(r"gambarQris:\s*'([^']*)'", t)
        print('=== keadaan pembayaran ===')
        print('  aktif    :', m.group(1) if m else '?')
        print('  rekening :', (rec.group(1) or '(kosong)') if rec else '(belum ada kolom)')
        print('  whatsapp :', (wa.group(1) or '(kosong)') if wa else '?')
        print('  gambar   :', (qr.group(1) or '(kosong)') if qr else '?')
        ada_beli = nomor_di_beli()
        print('  wa /beli/:', ada_beli or '(tidak ada)')
        if wa and ada_beli and ada_beli != wa.group(1):
            print('  SELISIH   : tombol WhatsApp di /beli/ beda dari setelan di atas')
        ada = os.path.exists(os.path.join(APP, (qr.group(1) if qr else ''))) if qr else False
        print('  berkas QR ada:', ada)
        print('\nUntuk menyalakan (pilih salah satu):')
        print('  tools/pasang-bayar.py --rekening "DANA 0812xxxxxxx a/n Nama" --whatsapp 62812xxxxxxx --kirim')
        print('  tools/pasang-bayar.py --qris ~/Desktop/qris.png --whatsapp 62812xxxxxxx --kirim')
        return 0

    if a.matikan:
        t = re.sub(r"aktif:\s*true", "aktif: false", t, count=1)
        tulis(t)
        print('pembayaran dimatikan kembali')
        return 0

    if a.qris:
        if not os.path.exists(a.qris):
            print('berkas gambar tidak ditemukan:', a.qris)
            return 2
        os.makedirs(os.path.dirname(GAMBAR_TUJUAN), exist_ok=True)
        shutil.copy(a.qris, GAMBAR_TUJUAN)
        print('gambar QRIS dipasang: static/img/qris-bayar.png (%.1f KB)' % (os.path.getsize(GAMBAR_TUJUAN) / 1024))

    if a.qris:
        # pemilik memilih QRIS saja: sembunyikan nomor rekening supaya layar bersih
        if 'tampilkanRekening' in t:
            t = re.sub(r"tampilkanRekening:\s*(true|false)", "tampilkanRekening: false", t, count=1)
        else:
            t = t.replace("aktivitas-default-tidak-ada", "aktivitas-default-tidak-ada")
        print('nomor rekening disembunyikan di layar bayar (mode QRIS saja)')

    if a.rekening:
        if 'rekening:' not in t:
            t = t.replace("  whatsapp: '',", "  rekening: '',              // tujuan uang bila memakai transfer/e-wallet\n  whatsapp: '',", 1)
        t = re.sub(r"rekening:\s*'[^']*'", "rekening: '%s'" % a.rekening.replace("'", "\\'"), t, count=1)
        print('tujuan uang dicatat:', a.rekening)

    if a.whatsapp:
        t = re.sub(r"whatsapp:\s*'[^']*'", "whatsapp: '%s'" % a.whatsapp.replace("'", "\\'"), t, count=1)
        print('kontak WhatsApp dicatat:', a.whatsapp)
        n_beli = samakan_beli(re.sub(r'[^0-9]', '', a.whatsapp))
        print('nomor di tombol /beli/ disamakan:', n_beli, 'tautan' if n_beli else 'TIDAK DITEMUKAN')
    if a.surel:
        t = re.sub(r"surel:\s*'[^']*'", "surel: '%s'" % a.surel.replace("'", "\\'"), t, count=1)
        print('surel kontak dicatat:', a.surel)

    t = re.sub(r"harga:\s*'[^']*'", "harga: '%s'" % a.harga, t, count=1)
    t = re.sub(r"aktif:\s*false", "aktif: true", t, count=1)
    tulis(t)

    r = subprocess.run(['node', '--check', FITUR11], capture_output=True, text=True)
    print('sintaks:', 'OK' if r.returncode == 0 else r.stderr[:200])
    if r.returncode != 0:
        return 1

    if a.kirim:
        pesan = '/tmp/pesan-bayar.txt'
        open(pesan, 'w', encoding='utf-8').write(
            'feat: nyalakan penerimaan pembayaran (%s)\n\n'
            'Tujuan uang dan kontak bukti diisi pemilik; alur pembelian di gerbang akses kini aktif sehingga\n'
            'pembeli bisa membayar, mengirim bukti, menerima kode akses, dan membuka seluruh aplikasi.\n'
            % (a.rekening or 'QRIS'))
        r2 = subprocess.run(['bash', 'tools/kirim.sh', pesan], cwd=APP, capture_output=True, text=True)
        print((r2.stdout or '')[-700:])
        return r2.returncode
    print('\nLangkah berikutnya: bash tools/kirim.sh /tmp/pesan-bayar.txt')
    return 0


if __name__ == '__main__':
    sys.exit(main())

#!/usr/bin/env python3
"""Bangun halaman 404 kustom untuk situs SiapPsikotes.

Gaya disalin dari halaman pendukung /beli/ supaya satu keluarga tampilan.
Pakai: /usr/bin/python3 tools/buat-404.py
"""
import os
import sys

AKAR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BELI = os.path.join(AKAR, 'beli', 'index.html')
KELUAR = os.path.join(AKAR, '404.html')


def gaya_dari_beli():
    isi = open(BELI, encoding='utf-8').read()
    awal = isi.index('<style>')
    akhir = isi.index('</style>') + len('</style>')
    return isi[awal:akhir]


HTML = '''<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline' https://accounts.google.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.googleusercontent.com https://www.gstatic.com; connect-src 'self' https://accounts.google.com https://www.googleapis.com https://siappsikotes-api.rasyidahmad180.workers.dev; frame-src https://accounts.google.com; object-src 'none'; base-uri 'self'; form-action 'none'">
<meta name="referrer" content="strict-origin-when-cross-origin">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#0a0f18">
<title>Halaman tidak ditemukan — SiapPsikotes</title>
<meta name="description" content="Alamat yang kamu buka tidak ada di SiapPsikotes. Ini jalan menuju halaman latihan, contoh soal gratis, harga, dan bukti mutu soal.">
<meta name="robots" content="noindex">
<link rel="icon" type="image/png" sizes="32x32" href="/static/icons/favicon-32.png">
<link rel="icon" type="image/png" sizes="192x192" href="/static/icons/icon-192.png">
<link rel="apple-touch-icon" sizes="180x180" href="/static/icons/apple-touch-icon-180.png">
__GAYA__
</head>
<body>
<a class="lewati" href="#isi">Langsung ke isi</a>

<header>
  <div class="wrap kepala">
    <a class="merek" href="/"><img src="/static/icons/icon-192.png" alt="" width="30" height="30"><span>SiapPsikotes</span></a>
    <nav aria-label="Halaman">
      <a href="/contoh/">Contoh gratis</a>
      <a href="/beli/">Beli</a>
      <a href="/mutu/">Mutu</a>
      <a href="/privasi/">Privasi</a>
      <a class="tombol sekunder kecil" href="/">Buka aplikasi</a>
    </nav>
  </div>
</header>

<main id="isi" class="wrap">
  <section class="pita">
    <span class="lencana">Error 404</span>
    <h1>Alamat ini tidak ada</h1>
    <p class="dek">Halaman yang kamu tuju tidak ditemukan. Mungkin salah ketik, atau tautannya sudah berpindah
      sejak situs pindah ke alamat siappsikotes.my.id. Semua yang kamu butuhkan ada di bawah ini.</p>
    <div class="aksi">
      <a class="tombol" href="/">Buka aplikasi</a>
      <a class="tombol sekunder" href="/contoh/">Coba 40 soal gratis</a>
    </div>
  </section>

  <h2 style="font-size:22px;margin:26px 0 10px">Halaman yang paling sering dicari</h2>
  <ul class="langkah">
    <li><a href="/">Aplikasi latihan</a> — 1.348 soal psikotes, tes IQ, dan kepribadian, berpembahasan tiap soal.</li>
    <li><a href="/contoh/">Contoh soal gratis</a> — 40 soal berpembahasan, tanpa akun dan tanpa bayar.</li>
    <li><a href="/psikotes/">Penjelasan paket</a> — isi lengkap dan untuk siapa latihan ini dibuat.</li>
    <li><a href="/beli/">Harga &amp; cara beli</a> — Rp 39.000 sekali bayar lewat QRIS, tanpa langganan.</li>
    <li><a href="/mutu/">Bukti mutu soal</a> — hasil pemeriksaan 1.348 soal yang bisa dijalankan ulang.</li>
    <li><a href="/syarat/">Syarat &amp; ketentuan</a> dan <a href="/privasi/">kebijakan privasi</a>.</li>
  </ul>

  <hr>
  <p class="berlaku" style="margin:0 0 26px">Kalau kamu yakin alamatnya benar dan tetap menemui halaman ini,
    kemungkinan ada tautan yang salah di suatu tempat. Laporkan lewat kanal kontak di
    <a href="/beli/">halaman harga</a> — kami perbaiki.</p>
</main>

<footer>
  <div class="wrap">
    <p><strong style="color:#eaf1f8">SiapPsikotes</strong> &mdash; latihan psikotes kerja, tes IQ, dan tes kepribadian.</p>
    <div class="tautan-kaki">
      <a href="/">Buka aplikasi</a>
      <a href="/contoh/">Contoh soal gratis</a>
      <a href="/beli/">Harga &amp; cara beli</a>
      <a href="/mutu/">Mutu &amp; bukti pemeriksaan</a>
      <a href="/privasi/">Kebijakan privasi</a>
    </div>
    <p>SiapPsikotes bukan produk resmi instansi mana pun dan tidak berafiliasi dengan lembaga pemerintah.</p>
    <p>Halaman ini diperbarui 17 September 2026.</p>
  </div>
</footer>
</body>
</html>
'''


def main():
    html = HTML.replace('__GAYA__', gaya_dari_beli())
    open(KELUAR, 'w', encoding='utf-8').write(html)
    print('berkas   : %s' % KELUAR)
    print('ukuran   : %.1f KB' % (os.path.getsize(KELUAR) / 1024.0))
    masalah = []
    if 'bukan produk resmi instansi' not in html:
        masalah.append('penyangkalan afiliasi hilang')
    if 'href="/contoh/"' not in html or 'href="/beli/"' not in html:
        masalah.append('tautan pemulihan tidak lengkap')
    if masalah:
        for m in masalah:
            print('MASALAH:', m)
        return 1
    print('penyangkalan afiliasi ada dan tautan pemulihan lengkap: LULUS')
    return 0


if __name__ == '__main__':
    sys.exit(main())

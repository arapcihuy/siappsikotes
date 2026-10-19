#!/usr/bin/env python3
"""Bangun gambar listing marketplace (Shopee/Tokopedia) 1080x1080 dari naskah.

Isi tiap gambar mengikuti spesifikasi di ~/tni-belajar/aset-bisnis/MARKETPLACE-LISTING.md bagian 4.
Angka kategori dibaca langsung dari data/soal-index.js supaya tidak ada angka karangan.

Pakai:  /usr/bin/python3 tools/buat-gambar-marketplace.py
Hasil:  ~/tni-belajar/aset-bisnis/gambar-marketplace/*.png
"""
import json
import os
import re
import sys

AKAR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INDEKS = os.path.join(AKAR, 'data', 'soal-index.js')
KELUAR = os.path.expanduser('~/tni-belajar/aset-bisnis/gambar-marketplace')
UKURAN = 1080

GAYA = """
  * { box-sizing:border-box; margin:0; padding:0; }
  body { width:%(u)dpx; height:%(u)dpx; font-family:-apple-system,"Segoe UI",Roboto,sans-serif;
    background:radial-gradient(900px 500px at 15%% -5%%, rgba(230,197,82,.18), transparent 60%%),
      radial-gradient(700px 420px at 95%% 5%%, rgba(109,179,255,.12), transparent 60%%), #0a0f18;
    color:#eaf1f8; display:flex; flex-direction:column; justify-content:space-between;
    padding:64px 62px; position:relative; overflow:hidden; }
  .merek { display:flex; align-items:center; gap:14px; font-weight:800; font-size:30px; letter-spacing:-.5px; }
  .merek .titik { width:22px; height:22px; border-radius:7px; background:linear-gradient(180deg,#f5c542,#c9a227); }
  .inti { text-align:center; }
  .angka { font-size:210px; font-weight:900; line-height:.92; letter-spacing:-8px;
    background:linear-gradient(180deg,#f7d774,#c9a227); -webkit-background-clip:text; background-clip:text; color:transparent; }
  h1 { font-size:74px; font-weight:900; line-height:1.08; letter-spacing:-2px; margin-bottom:18px; }
  h1 kecil { display:block; font-size:34px; font-weight:600; color:#b3c0d1; letter-spacing:0; margin-top:14px; }
  .pita { display:inline-block; font-size:26px; font-weight:800; letter-spacing:.14em; text-transform:uppercase;
    color:#1a1405; background:linear-gradient(180deg,#f5c542,#c9a227); padding:12px 22px; border-radius:999px; }
  ul { list-style:none; text-align:left; display:grid; gap:16px; }
  li { display:flex; align-items:center; gap:16px; font-size:34px; font-weight:600;
    background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.10); border-radius:18px; padding:18px 24px; }
  li b { color:#e6c552; }
  .kaki { display:flex; justify-content:space-between; align-items:center;
    font-size:28px; color:#b3c0d1; border-top:1px solid rgba(255,255,255,.10); padding-top:24px; }
  .kaki strong { color:#eaf1f8; }
  /* ponsel */
  .ponsel { width:430px; margin:0 auto; border:12px solid #1e2a3d; border-radius:52px; padding:26px 22px 30px;
    background:#0f1626; box-shadow:0 30px 70px rgba(0,0,0,.55); }
  .soal { font-size:26px; font-weight:700; line-height:1.35; margin-bottom:20px; }
  .opsi { display:grid; gap:12px; }
  .opsi div { font-size:24px; padding:14px 18px; border-radius:14px; background:#1e2a3d;
    border:1px solid rgba(255,255,255,.16); }
  .opsi div.benar { background:rgba(74,222,128,.16); border-color:#4ade80; }
  .langkah { display:grid; gap:20px; }
  .langkah div { display:flex; align-items:center; gap:20px; font-size:36px; font-weight:700;
    background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.12); border-radius:20px; padding:22px 26px; }
  .langkah span.n { flex:0 0 60px; height:60px; border-radius:50%%; background:linear-gradient(180deg,#f5c542,#c9a227);
    color:#1a1405; display:flex; align-items:center; justify-content:center; font-size:32px; font-weight:900; }
  .cek { font-size:56px; text-align:left; display:grid; gap:18px; }
  .cek div { display:flex; gap:18px; align-items:center; }
  .cek i { color:#4ade80; font-style:normal; font-weight:900; }
  .kecil { font-size:26px; color:#b3c0d1; margin-top:18px; }
  .harga { font-size:150px; font-weight:900; letter-spacing:-4px; color:#eaf1f8; }
  .harga kecil { display:block; font-size:34px; font-weight:600; color:#b3c0d1; letter-spacing:0; margin-top:8px; }
"""


def baca_kategori():
    isi = open(INDEKS, encoding='utf-8').read()
    m = re.search(r'window\.DATA_SOAL_INDEX\s*=\s*(\{.*?\});', isi, re.S)
    data = json.loads(m.group(1))
    urut = ['penalaran_logika', 'numerik', 'matematika', 'verbal',
            'bahasa_inggris', 'tkw', 'kraepelin', 'tes_gambar', 'kepribadian']
    return [(data[k]['nama'], data[k]['jumlah']) for k in urut if k in data]


def halaman(isi, gaya_tambahan=''):
    return """<!DOCTYPE html><html lang="id"><head><meta charset="utf-8">
<style>%s%s</style></head><body>%s</body></html>""" % (
        GAYA % {'u': UKURAN}, gaya_tambahan, isi)


def gambar():
    kat = baca_kategori()
    total = sum(j for _, j in kat)
    daftar = ''.join('<li><b>%d</b> %s</li>' % (j, n) for n, j in kat[:5])

    keluar = []

    # 1. Gambar utama
    keluar.append(('01-gambar-utama', halaman(
        '<div class="merek"><span class="titik"></span>SiapPsikotes</div>'
        '<div class="inti">'
        '<div class="ponsel">'
        '<div class="soal">PERWIRA : TNI = KOMISIONER : ...</div>'
        '<div class="opsi"><div>POLRI</div><div>BPK</div><div>KPK</div><div>DPR</div></div>'
        '</div>'
        '<div class="angka" style="font-size:150px;margin-top:26px">%d</div>'
        '<div class="pita" style="margin-top:10px">Soal psikotes + pembahasan</div>'
        '</div>'
        '<div class="kaki"><span><strong>Tes IQ &amp; Kepribadian</strong> &middot; 40 soal contoh gratis</span>'
        '<span>siappsikotes.my.id</span></div>' % total)))

    # 2. Bukti isi
    keluar.append(('02-isi-lengkap', halaman(
        '<div class="merek"><span class="titik"></span>SiapPsikotes</div>'
        '<div><div class="pita" style="margin-bottom:22px">Isi lengkap</div>'
        '<h1 style="font-size:60px">Logika &middot; Numerik &middot; Gambar &middot; Big Five</h1>'
        '<ul style="margin-top:26px">%s</ul>'
        '<div class="kecil">%d kategori, semuanya dengan pembahasan langkah demi langkah.</div></div>'
        '<div class="kaki"><span>Latihan, bukan tes resmi</span><span>siappsikotes.my.id</span></div>'
        % (daftar, len(kat)))))

    # 3. Cara pakai
    keluar.append(('03-cara-pakai', halaman(
        '<div class="merek"><span class="titik"></span>SiapPsikotes</div>'
        '<div><h1 style="font-size:58px;margin-bottom:26px">Bayar &rarr; kirim bukti<br>&rarr; terima kode akses</h1>'
        '<div class="langkah">'
        '<div><span class="n">1</span>Pindai QRIS di halaman harga</div>'
        '<div><span class="n">2</span>Kirim bukti ke WhatsApp pengelola</div>'
        '<div><span class="n">3</span>Terima kode, tempel di aplikasi</div>'
        '</div></div>'
        '<div class="kaki"><span>Kode dikirim pada hari yang sama</span><span>siappsikotes.my.id</span></div>')))

    # 4. Kejujuran / nilai
    keluar.append(('04-nilai-jujur', halaman(
        '<div class="merek"><span class="titik"></span>SiapPsikotes</div>'
        '<div class="cek">'
        '<div><i>&#10003;</i> 40 soal contoh gratis</div>'
        '<div><i>&#10003;</i> Tanpa akun, tanpa pendaftaran</div>'
        '<div><i>&#10003;</i> Bisa dipakai offline</div>'
        '<div><i>&#10003;</i> Pembahasan tiap soal</div>'
        '<div class="kecil">Data latihanmu tersimpan di perangkatmu sendiri.</div>'
        '</div>'
        '<div class="kaki"><span>Latihan mandiri, bukan tes resmi</span><span>siappsikotes.my.id</span></div>')))

    # 5. Harga & syarat
    keluar.append(('05-harga-syarat', halaman(
        '<div class="merek"><span class="titik"></span>SiapPsikotes</div>'
        '<div class="inti"><div class="harga">Rp 39.000<kecil>sekali bayar &middot; bukan langganan</kecil></div>'
        '<p class="kecil" style="margin-top:26px;font-size:30px;color:#eaf1f8">'
        'Kode akses tidak bisa dikembalikan setelah dikirim.<br>'
        'Kode yang tidak bekerja diganti tanpa biaya tambahan.</p></div>'
        '<div class="kaki"><span>%d soal + pembahasan</span><span>siappsikotes.my.id</span></div>' % total)))

    return keluar


def main():
    from playwright.sync_api import sync_playwright
    os.makedirs(KELUAR, exist_ok=True)
    hasil = gambar()
    terbentuk = []
    with sync_playwright() as p:
        b = p.chromium.launch(channel='chrome')
        page = b.new_page(viewport={'width': UKURAN, 'height': UKURAN}, device_scale_factor=1)
        for nama, html in hasil:
            page.set_content(html, wait_until='load')
            page.wait_for_timeout(250)
            jalur = os.path.join(KELUAR, nama + '.png')
            page.screenshot(path=jalur)
            ukuran = os.path.getsize(jalur)
            terbentuk.append((nama, ukuran))
            print('  %-22s %6.1f KB' % (nama + '.png', ukuran / 1024.0))
        b.close()

    print()
    print('gambar terbentuk : %d' % len(terbentuk))
    print('ukuran tiap file : %dx%d piksel' % (UKURAN, UKURAN))
    print('keluaran         : %s' % KELUAR)
    gagal = [n for n, u in terbentuk if u < 20000]
    if gagal:
        print('PERINGATAN: gambar berikut terlalu kecil, mungkin gagal dirender:', gagal)
        return 1
    print('semua gambar berisi (bukan halaman kosong): LULUS')
    return 0


if __name__ == '__main__':
    sys.exit(main())

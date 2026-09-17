#!/usr/bin/env python3
"""Bangun selebaran (flyer) A5 + gambar untuk dibagikan di WhatsApp.

Isi: QR menuju halaman contoh gratis, penjelasan singkat, harga, dan penyangkalan jujur.
Hasil di ~/pk-bisnis/flyer/ (PDF siap cetak + PNG untuk dibagikan).

Pakai: /usr/bin/python3 tools/buat-flyer.py
QR dibuat lewat ~/venv-siappsikotes/bin/python3 tools/buat-qr-png.py (butuh segno).
"""
import os
import subprocess
import sys

AKAR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KELUAR = os.path.expanduser('~/pk-bisnis/flyer')
TAUTAN = 'https://siappsikotes.my.id/contoh/'
VENV = os.path.expanduser('~/venv-siappsikotes/bin/python3')
QR = os.path.join(KELUAR, 'qr-contoh.png')
# A5 pada 300 dpi
LEBAR, TINGGI = 1748, 2480

HTML = """<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { width:%(w)dpx; height:%(h)dpx; font-family:-apple-system,"Segoe UI",Roboto,sans-serif;
    background:radial-gradient(1200px 700px at 20%% -5%%, rgba(230,197,82,.20), transparent 60%%),
      radial-gradient(900px 600px at 95%% 8%%, rgba(109,179,255,.14), transparent 60%%), #0a0f18;
    color:#eaf1f8; display:flex; flex-direction:column; justify-content:space-between; padding:110px 96px; }
  .merek { display:flex; align-items:center; gap:18px; font-size:44px; font-weight:800; letter-spacing:-.5px; }
  .titik { width:30px; height:30px; border-radius:9px; background:linear-gradient(180deg,#f5c542,#c9a227); }
  h1 { font-size:118px; line-height:1.02; letter-spacing:-4px; font-weight:900; }
  h1 span { color:#e6c552; }
  .dek { font-size:40px; color:#c9d5e3; line-height:1.4; margin-top:26px; max-width:24em; }
  .qr { text-align:center; margin:54px 0 34px; }
  .qr img { width:640px; height:640px; background:#fff; padding:22px; border-radius:28px; }
  .qr p { font-size:36px; color:#b3c0d1; margin-top:22px; }
  ul { list-style:none; display:grid; gap:20px; }
  li { font-size:38px; font-weight:600; display:flex; gap:18px; align-items:center; }
  li i { color:#4ade80; font-style:normal; font-weight:900; }
  .harga { margin-top:44px; padding:34px 40px; border-radius:24px; border:1px solid rgba(230,197,82,.38);
    background:linear-gradient(150deg, rgba(230,197,82,.16), rgba(230,197,82,.04) 50%%, rgba(23,33,51,.5)); }
  .harga b { font-size:52px; }
  .harga span { display:block; font-size:32px; color:#c9d5e3; margin-top:12px; }
  .kaki { border-top:1px solid rgba(255,255,255,.12); padding-top:30px; font-size:30px; color:#b3c0d1;
    display:flex; justify-content:space-between; align-items:flex-end; }
  .kaki strong { color:#eaf1f8; }
</style></head><body>
  <div>
    <div class="merek"><span class="titik"></span>SiapPsikotes</div>
    <h1 style="margin-top:56px">40 soal psikotes <span>gratis</span>,<br>lengkap dengan pembahasan</h1>
    <p class="dek">Pindai kode di bawah, kerjakan langsung di peramban. Tanpa akun, tanpa pendaftaran.</p>
  </div>
  <div class="qr">
    <img src="%(qr)s" alt="Kode QR menuju 40 soal psikotes gratis">
    <p>atau buka <strong style="color:#eaf1f8">siappsikotes.my.id/contoh</strong></p>
  </div>
  <div>
    <ul>
      <li><i>&#10003;</i> Pembahasan langkah demi langkah tiap soal</li>
      <li><i>&#10003;</i> Bisa dipakai offline setelah dibuka sekali</li>
      <li><i>&#10003;</i> Data latihanmu tersimpan di perangkatmu sendiri</li>
    </ul>
    <div class="harga"><b>Akses penuh: Rp 39.000 sekali bayar</b>
      <span>1.348 soal &middot; 9 jenis tes &middot; Laporan Lengkap &middot; bukan langganan</span></div>
  </div>
  <div class="kaki">
    <span>Latihan mandiri. <strong>Bukan tes resmi</strong> dan tidak menjamin kelulusan seleksi.</span>
    <span>siappsikotes.my.id</span>
  </div>
</body></html>
"""


HTML_TERANG = """<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { width:%(w)dpx; height:%(h)dpx; font-family:-apple-system,"Segoe UI",Roboto,sans-serif;
    background:#ffffff; color:#14181f; display:flex; flex-direction:column; justify-content:space-between;
    padding:110px 96px; }
  .merek { display:flex; align-items:center; gap:18px; font-size:44px; font-weight:800; letter-spacing:-.5px; color:#14181f; }
  .titik { width:30px; height:30px; border-radius:9px; background:#e0b528; }
  h1 { font-size:118px; line-height:1.02; letter-spacing:-4px; font-weight:900; }
  h1 span { color:#8a6a00; }
  .dek { font-size:40px; color:#3d4552; line-height:1.4; margin-top:26px; max-width:24em; }
  .qr { text-align:center; margin:54px 0 34px; }
  .qr img { width:640px; height:640px; padding:22px; border-radius:28px; border:4px solid #e6e9ee; }
  .qr p { font-size:36px; color:#3d4552; margin-top:22px; }
  ul { list-style:none; display:grid; gap:20px; }
  li { font-size:38px; font-weight:600; display:flex; gap:18px; align-items:center; }
  li i { color:#1a7f37; font-style:normal; font-weight:900; }
  .harga { margin-top:44px; padding:34px 40px; border-radius:24px; border:4px solid #8a6a00; background:#fbf1d4; }
  .harga b { font-size:52px; }
  .harga span { display:block; font-size:32px; color:#3d4552; margin-top:12px; }
  .kaki { border-top:2px solid #e6e9ee; padding-top:30px; font-size:30px; color:#3d4552;
    display:flex; justify-content:space-between; align-items:flex-end; }
  .kaki strong { color:#14181f; }
</style></head><body>
  <div>
    <div class="merek"><span class="titik"></span>SiapPsikotes</div>
    <h1 style="margin-top:56px">40 soal psikotes <span>gratis</span>,<br>lengkap dengan pembahasan</h1>
    <p class="dek">Pindai kode di bawah, kerjakan langsung di peramban. Tanpa akun, tanpa pendaftaran.</p>
  </div>
  <div class="qr">
    <img src="%(qr)s" alt="Kode QR menuju 40 soal psikotes gratis">
    <p>atau buka <strong style="color:#14181f">siappsikotes.my.id/contoh</strong></p>
  </div>
  <div>
    <ul>
      <li><i>&#10003;</i> Pembahasan langkah demi langkah tiap soal</li>
      <li><i>&#10003;</i> Bisa dipakai offline setelah dibuka sekali</li>
      <li><i>&#10003;</i> Data latihanmu tersimpan di perangkatmu sendiri</li>
    </ul>
    <div class="harga"><b>Akses penuh: Rp 39.000 sekali bayar</b>
      <span>1.348 soal &middot; 9 jenis tes &middot; Laporan Lengkap &middot; bukan langganan</span></div>
  </div>
  <div class="kaki">
    <span>Latihan mandiri. <strong>Bukan tes resmi</strong> dan tidak menjamin kelulusan seleksi.</span>
    <span>siappsikotes.my.id</span>
  </div>
</body></html>
"""


def main():
    os.makedirs(KELUAR, exist_ok=True)

    # 1. QR (butuh segno -> pakai venv)
    if not os.path.exists(VENV):
        print('PERINGATAN: venv segno tidak ada di %s' % VENV)
        return 1
    r = subprocess.run([VENV, os.path.join(AKAR, 'tools', 'buat-qr-png.py'), TAUTAN, QR],
                       capture_output=True, text=True)
    print(r.stdout.strip() or r.stderr.strip()[:200])
    if not os.path.exists(QR):
        print('QR gagal dibuat')
        return 1

    # 2. Render (QR ditempel sebagai data URI supaya tidak bergantung pada jalur berkas)
    import base64
    from playwright.sync_api import sync_playwright
    qr_data = 'data:image/png;base64,' + base64.b64encode(open(QR, 'rb').read()).decode('ascii')
    html = HTML % {'w': LEBAR, 'h': TINGGI, 'qr': qr_data}
    html_terang = HTML_TERANG % {'w': LEBAR, 'h': TINGGI, 'qr': qr_data}
    hasil_berkas = []
    with sync_playwright() as p:
        b = p.chromium.launch(channel='chrome')
        for isi, awalan in ((html, 'selebaran-a5'), (html_terang, 'selebaran-a5-terang')):
            page = b.new_page(viewport={'width': LEBAR, 'height': TINGGI})
            page.set_content(isi, wait_until='load')
            page.wait_for_timeout(600)
            # penjaga: QR harus benar-benar tergambar, bukan gagal muat
            qr_ok = page.evaluate("""(() => { const i = document.querySelector('.qr img');
                return i ? { ada: true, lebar: i.naturalWidth, tinggi: i.naturalHeight } : { ada: false }; })()""")
            if not (qr_ok.get('ada') and qr_ok.get('lebar', 0) > 100):
                print('GAGAL: gambar QR tidak tergambar pada %s (%s)' % (awalan, qr_ok))
                b.close()
                return 1
            png = os.path.join(KELUAR, awalan + '.png')
            page.screenshot(path=png)
            pdf = os.path.join(KELUAR, awalan + '.pdf')
            page.pdf(path=pdf, width='148mm', height='210mm', print_background=True,
                     margin={'top': '0', 'right': '0', 'bottom': '0', 'left': '0'})
            hasil_berkas += [png, pdf]
            print('QR tergambar pada %s: %sx%s piksel' % (awalan, qr_ok['lebar'], qr_ok['tinggi']))
            page.close()
        b.close()

    for f in hasil_berkas:
        print('  %-28s %7.1f KB' % (os.path.basename(f), os.path.getsize(f) / 1024.0))

    # 3. Periksa isi
    kurang = []
    for wajib in ['bukan tes resmi', 'Rp 39.000', 'gratis', 'siappsikotes.my.id']:
        if wajib.lower() not in html.lower():
            kurang.append(wajib)
    if kurang:
        print('MASALAH: teks wajib hilang ->', kurang)
        return 1
    print('teks wajib lengkap (harga, penyangkalan, tautan): LULUS')
    print('keluaran: %s' % KELUAR)
    return 0


if __name__ == '__main__':
    sys.exit(main())

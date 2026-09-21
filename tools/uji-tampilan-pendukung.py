#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Uji tampilan halaman pendukung: /mutu/, /beli/, /syarat/, /privasi/.

Halaman pendukung pernah rusak tanpa ketahuan: latar dibuat gelap tetapi warna teks
masih setelan tema terang, sehingga isi halaman tidak terbaca (kontras 1,1:1), dan
tombol utama di /beli/ tidak punya gaya sama sekali. Uji ini menjaga hal itu terulang:

  - kepala + kaki halaman ada, penyangkalan afiliasi tetap tercetak;
  - warna teks terang di latar gelap (tema navy + emas);
  - axe-core: 0 pelanggaran WCAG 2.1 AA & kontras teks >= 4,5:1;
  - tanpa geser horizontal pada 1280 px dan 390 px, tidak ada elemen keluar layar;
  - tombol cukup besar untuk disentuh (>= 38 px); yang diukur hanya tombol yang benar-benar
    tampil, sebab elemen tersembunyi tidak bisa disentuh sama sekali (bilah hasil /contoh/
    memang baru muncul setelah ada jawaban);
  - logika /beli/ utuh: nominal unik, kode rujukan = 3 angka terakhir nominal,
    tombol bukti membawa kode rujukan, gambar QR termuat dan latarnya putih (bisa dipindai),
    nama merchant yang akan dilihat pembeli dijelaskan SEBELUM QR-nya dipindai;
  - tombol "Kirim bukti lewat WhatsApp" tetap tautan WhatsApp walau skrip halaman tidak jalan;
  - bilah hasil di /contoh/: tersembunyi sebelum ada jawaban, skornya cocok, tautan bagikan
    hanya WhatsApp berisi pesan pembaca sendiri, dan tersembunyi lagi setelah "Mulai ulang";
  - gerbang kode akses (langkah SETELAH membayar): terkunci sebelum kode, kode salah ditolak
    dengan pesan, dan kode buatan tools/buat-kode.py benar-benar membuka aplikasi.
  - satu klik dari /beli/ ke aplikasi: tombol "Buka aplikasi & pakai kode ini" membawa kode
    di alamat (?kode=) dan kode itu benar-benar membuka aplikasi di peramban yang bersih,
    lalu tidak tertinggal di alamat; pesan WhatsApp tidak lagi menunggu kiriman kode akses.
  - /favicon.ico: ada di akar situs dan berupa ICO asli (peramban memintanya tanpa
    membaca <link rel="icon">, dan jalur ini pernah 404 di setiap kunjungan).
  - /llms.txt: berkas yang dibaca mesin pencari AI (tanpa akun dan tanpa peringkat Google).
    Daftar tautannya harus menunjuk berkas yang benar-benar ada - bukan tautan karangan.

Pakai Chrome asli (channel='chrome'), bukan chromium bawaan Playwright.
Bila Playwright/Chrome tidak tersedia: cetak LEWAT + alasannya, keluar dengan kode 0.

Pakai:  /usr/bin/python3 tools/uji-tampilan-pendukung.py
"""
import functools
import http.server
import os
import re
import sys
import threading
import urllib.parse
import urllib.request

AKAR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AXE = os.path.join(AKAR, 'tools', 'axe.min.js')
PORT = 8791
HAL = ['mutu/', 'beli/', 'lisensi/', 'syarat/', 'privasi/', 'contoh/', '404.html',
       'contoh-soal-psikotes-kerja/', 'contoh-soal-psikotes-matematika/',
       'contoh-soal-deret-angka/', 'contoh-soal-tes-kraepelin/',
       'contoh-soal-twk-cpns/', 'contoh-soal-tiu-cpns/',
       'contoh-soal-psikotes-bahasa-inggris/', 'contoh-soal-psikotes-kepribadian/',
       'contoh-soal-psikotes-daya-ingat/', 'contoh-soal-psikotes-polri/',
       'contoh-soal-psikotes-bumn/', 'contoh-soal-psikotes-kai/']
RUSAK = '--rusak' in sys.argv   # mode pembuktian: uji HARUS menangkap kerusakan yang disuntikkan
hasil = []


def cek(syarat, label, bukti=''):
    # penjaga: argumen yang salah urut membuat SEMUA asersi lolos otomatis (uji palsu)
    if isinstance(syarat, str):
        raise SystemExit('ARGUMEN SALAH URUT - tanda tangan: cek(syarat, label, bukti)')
    hasil.append((bool(syarat), label))
    print(('  OK    ' if syarat else '  GAGAL ') + '| ' + label + (('  -> %s' % str(bukti)[:300]) if bukti else ''))


class Peladen(http.server.ThreadingHTTPServer):
    daemon_threads = True   # tanpa ini 40+ permintaan mengantre dan uji tampak menggantung


def main():
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as e:
        print('  LEWAT | Playwright tidak terpasang (%s) - jalankan: /usr/bin/python3 -m pip install playwright' % e)
        return 0
    if not os.path.isfile(AXE):
        print('  LEWAT | tools/axe.min.js tidak ada di repo, pemeriksaan aksesibilitas dilewati')
        return 0

    penangan = functools.partial(http.server.SimpleHTTPRequestHandler, directory=AKAR)
    httpd = Peladen(('127.0.0.1', PORT), penangan)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()

    try:
        with sync_playwright() as p:
            try:
                browser = p.chromium.launch(channel='chrome')
            except Exception as e:
                print('  LEWAT | Chrome asli tidak bisa dijalankan (%s)' % str(e)[:120])
                httpd.shutdown()
                return 0
            konteks = browser.new_context(viewport={'width': 1280, 'height': 900})
            konteks.add_init_script(path=AXE)
            page = konteks.new_page()
            galat = []
            page.on('pageerror', lambda e: galat.append(str(e)[:150]))

            for jalur in HAL:
                page.goto('http://127.0.0.1:%d/%s' % (PORT, jalur), wait_until='load', timeout=45000)
                page.wait_for_timeout(350)
                d = page.evaluate("""async () => {
                    const b = getComputedStyle(document.body);
                    const r = await axe.run(document, { runOnly: ['wcag2a','wcag2aa','wcag21a','wcag21aa'] });
                    return {
                        warna: b.color, latar: b.backgroundColor,
                        lebar: document.documentElement.scrollWidth, layar: window.innerWidth,
                        axe: r.violations.map(v => v.id + '(' + v.nodes.length + ')'),
                        kepala: !!document.querySelector('header .merek'),
                        kaki: !!document.querySelector('footer'),
                        penyangkalan: document.body.innerText.indexOf('bukan produk resmi') >= 0,
                        keluarLayar: Array.from(document.querySelectorAll('body *')).filter(el => {
                            const q = el.getBoundingClientRect();
                            const pos = getComputedStyle(el).position;
                            return q.right > window.innerWidth + 2 && q.width > 12 && pos !== 'fixed';
                        }).length
                    };
                }""")
                cek(d['kepala'] and d['kaki'], '%s: kepala + kaki halaman ada' % jalur)
                cek(d['penyangkalan'], '%s: penyangkalan afiliasi tetap ada' % jalur)
                if RUSAK:
                    # harapan yang sengaja salah: harus GAGAL, kalau lulus berarti uji tidak mengukur apa pun
                    cek(d['warna'] == 'rgb(0, 0, 0)', '%s: [RUSAK] harapan palsu warna teks' % jalur, d['warna'])
                else:
                    cek(d['warna'] == 'rgb(234, 241, 248)' and d['latar'] == 'rgb(10, 15, 24)',
                        '%s: teks terang di latar navy' % jalur, [d['warna'], d['latar']])
                cek(not d['axe'], '%s: axe-core 0 pelanggaran WCAG 2.1 AA' % jalur, d['axe'])
                cek(d['lebar'] <= d['layar'] + 1 and not d['keluarLayar'],
                    '%s: tanpa geser horizontal 1280px' % jalur, {'isi': d['lebar'], 'luar': d['keluarLayar']})

                sempit = konteks.new_page()
                sempit.set_viewport_size({'width': 390, 'height': 844})
                sempit.goto('http://127.0.0.1:%d/%s' % (PORT, jalur), wait_until='load', timeout=45000)
                sempit.wait_for_timeout(300)
                s = sempit.evaluate("""() => ({
                    isi: document.documentElement.scrollWidth, layar: window.innerWidth,
                    ukuranKetuk: Array.from(document.querySelectorAll('a.tombol, button.tombol'))
                        .filter(a => a.getClientRects().length)
                        .map(a => Math.round(a.getBoundingClientRect().height))
                })""")
                cek(s['isi'] <= s['layar'] + 1, '%s: tanpa geser horizontal 390px' % jalur, s)
                cek(all(h >= 38 for h in s['ukuranKetuk']), '%s: tombol nyaman disentuh (>=38px)' % jalur,
                    s['ukuranKetuk'])
                sempit.close()

            page.goto('http://127.0.0.1:%d/beli/' % PORT, wait_until='load', timeout=45000)
            page.wait_for_timeout(400)
            b = page.evaluate("""() => ({
                notaSebelumQr: (() => { const n = document.querySelector('.nota-merchant');
                    const i = document.querySelector('.qris-kotak img');
                    if (!n || !i) return null;
                    return Math.round(n.getBoundingClientRect().top)
                        < Math.round(i.getBoundingClientRect().top); })(),
                nominal: document.getElementById('beliNominal').textContent.trim(),
                nominal2: document.getElementById('beliNominal2').textContent.trim(),
                rujukan: document.getElementById('beliRujukan').textContent.trim(),
                tautan: document.getElementById('beliBukti').getAttribute('href'),
                tautanAplikasi: (Array.from(document.querySelectorAll('a'))
                    .filter((x) => (x.getAttribute('href') || '').indexOf('../#sp-') === 0)
                    .map((x) => x.getAttribute('href'))[0]) || '',
                qr: (() => { const i = document.querySelector('.qris-kotak img');
                    const r = i.getBoundingClientRect();
                    return { w: Math.round(r.width), h: Math.round(r.height),
                             latar: getComputedStyle(i.parentElement).backgroundColor,
                             termuat: !!(i.complete && i.naturalWidth > 0) }; })()
            })""")
            cek(bool(re.match(r'^Rp 39\.\d{3}$', b['nominal'])), '/beli/: nominal unik tampil', b['nominal'])
            cek(b['nominal'] == b['nominal2'], '/beli/: nominal sama di dua tempat', b['nominal'])
            cek(bool(re.match(r'^SP-\d{3}$', b['rujukan'])), '/beli/: kode rujukan tampil', b['rujukan'])
            cek(b['rujukan'].split('-')[1] == b['nominal'].replace('.', '')[-3:],
                '/beli/: kode rujukan = 3 angka terakhir nominal', [b['rujukan'], b['nominal']])
            cek(b['rujukan'] in (b['tautan'] or ''), '/beli/: tombol bukti membawa kode rujukan')
            cek(b['qr']['termuat'] and abs(b['qr']['w'] - b['qr']['h']) <= 2,
                '/beli/: gambar QR termuat & tidak gepeng', b['qr'])
            cek(b['qr']['latar'] == 'rgb(255, 255, 255)', '/beli/: latar QR putih (bisa dipindai)', b['qr']['latar'])
            # Kode QRIS ini terdaftar atas nama merchant lain. Bila pembeli baru tahu setelah
            # memindai, pembayaran yang sudah di ujung jari itulah yang dibatalkan; karena itu
            # penjelasannya harus terbaca sebelum QR-nya, bukan catatan kaki sesudah tombol.
            cek(b['notaSebelumQr'] is True, '/beli/: nama merchant dijelaskan sebelum QR dipindai',
                b['notaSebelumQr'])
            # Nomor rujukan dulu dibuat ulang tiap muat halaman bila penyimpanan peramban
            # diblokir (mode privat, cookie ditolak). Pembeli yang memuat ulang antara
            # membayar dan mengirim bukti lalu memegang kode rujukan yang tidak lagi cocok
            # dengan nominal yang ia bayar. Sekarang angkanya ikut disimpan di alamat halaman.
            kode_alamat = page.url.split('#')[1] if '#' in page.url else ''
            cek(kode_alamat == 'sp-' + b['rujukan'].split('-')[1],
                '/beli/: nomor rujukan tersimpan di alamat halaman', page.url)
            cek(b['tautanAplikasi'].endswith('#' + b['rujukan'].replace('SP-', 'sp-')),
                '/beli/: tautan ke aplikasi membawa angka rujukan yang sama',
                b['tautanAplikasi'])
            tanpa_simpanan = browser.new_context(viewport={'width': 390, 'height': 844})
            tanpa_simpanan.add_init_script(
                "Object.defineProperty(window, 'localStorage', "
                "{ get: function () { throw new Error('penyimpanan diblokir'); } });")
            pk = tanpa_simpanan.new_page()
            pk.goto('http://127.0.0.1:%d/beli/' % PORT, wait_until='load', timeout=45000)
            pk.wait_for_timeout(300)
            baca = ("() => ({ n: document.getElementById('beliNominal').textContent.trim(),"
                    " r: document.getElementById('beliRujukan').textContent.trim(),"
                    " u: location.href })")
            a1 = pk.evaluate(baca)
            pk.reload(wait_until='load')
            pk.wait_for_timeout(300)
            a2 = pk.evaluate(baca)
            cek(a1['n'] == a2['n'] and a1['r'] == a2['r'],
                '/beli/: nominal & rujukan tetap walau penyimpanan diblokir + muat ulang',
                [a1['n'], a2['n'], a1['r'], a2['r']])
            cek('#sp-' + a2['r'].split('-')[1] in (a2['u'] or ''),
                '/beli/: muat ulang memakai angka yang tersimpan di alamat', a2['u'])
            # Sisi aplikasi (fitur11.js) memakai aturan yang sama; kalau tidak, kode
            # rujukan di kuitansi bisa berbeda dari yang dipakai di halaman beli.
            pk.goto('http://127.0.0.1:%d/' % PORT, wait_until='load', timeout=45000)
            pk.wait_for_timeout(400)
            k1 = pk.evaluate("() => kodeBayar().rujukan")
            pk.reload(wait_until='load')
            pk.wait_for_timeout(400)
            k2 = pk.evaluate("() => kodeBayar().rujukan")
            cek(k1 == k2, '/: kode rujukan aplikasi stabil walau penyimpanan diblokir', [k1, k2])
            pk.goto('http://127.0.0.1:%d/#sp-321' % PORT, wait_until='load', timeout=45000)
            pk.wait_for_timeout(400)
            k3 = pk.evaluate("() => kodeBayar().rujukan")
            cek(k3 == 'SP-321', '/: aplikasi memakai angka rujukan yang dibawa tautan /beli/',
                [k3, pk.url])
            tanpa_simpanan.close()
            # Pengunjung yang skripnya gagal (peramban dalam aplikasi, saringan jaringan, galat JS)
            # tetap harus sampai ke WhatsApp. Sebelum ini tombol "Kirim bukti lewat WhatsApp"
            # hanya menjadi tautan wa.me setelah skrip berjalan; tanpa skrip ia membuka draf surel.
            tanpaskrip = browser.new_context(viewport={'width': 390, 'height': 844},
                                            java_script_enabled=False)
            halaman_tanpa_skrip = tanpaskrip.new_page()
            halaman_tanpa_skrip.goto('http://127.0.0.1:%d/beli/' % PORT, wait_until='load', timeout=45000)
            t = halaman_tanpa_skrip.evaluate(
                "() => document.getElementById('beliBukti').getAttribute('href') || ''")
            cek(t.startswith('https://wa.me/'), '/beli/: tombol WhatsApp tetap WhatsApp tanpa skrip', t[:80])
            tanpaskrip.close()
            # /contoh/ tanpa skrip: 40 soal gratis itu satu-satunya isi produk yang terbuka,
            # jadi harus terbaca walau JavaScript mati - oleh pembaca layar, pengunjung lama,
            # dan perayap mesin pencari yang tidak menjalankan skrip. Sebelum ini halaman
            # hanya berisi kerangka (~1,9 KB teks) dan 40 soalnya digambar oleh skrip.
            tanpaskrip2 = browser.new_context(viewport={'width': 390, 'height': 844},
                                              java_script_enabled=False)
            halaman_contoh = tanpaskrip2.new_page()
            halaman_contoh.goto('http://127.0.0.1:%d/contoh/' % PORT, wait_until='load', timeout=45000)
            statis = halaman_contoh.evaluate("""() => {
                const kartu = document.querySelectorAll('#contoh-daftar .kartu-soal');
                const teks = (document.getElementById('contoh-daftar').innerText || '').trim();
                const kecil = teks.toLowerCase();
                return {
                    jumlah: kartu.length,
                    pilihan: kartu.length ? kartu[0].querySelectorAll('.statis-pilih li').length : 0,
                    panjang: teks.length,
                    adaBahas: kecil.indexOf('pembahasan') >= 0,
                    adaKunci: kecil.indexOf('(jawaban)') >= 0 };
            }""")
            tanpaskrip2.close()
            cek(statis['jumlah'] >= 40 and statis['pilihan'] >= 4
                and statis['adaBahas'] and statis['adaKunci'],
                '/contoh/: 40 soal + pembahasan terbaca tanpa JavaScript', statis)
            cek(statis['panjang'] >= 8000,
                '/contoh/: teks statis cukup banyak untuk dibaca mesin pencari', statis['panjang'])
            print('== /contoh/: soal gratis berpembahasan ==')
            page.goto('http://127.0.0.1:%d/contoh/' % PORT, wait_until='load', timeout=45000)
            page.wait_for_timeout(500)
            c = page.evaluate("""() => {
                const kartu = document.querySelectorAll('.kartu-soal');
                const k0 = kartu[0];
                const tombol = k0.querySelectorAll('.pilih');
                const bahasSebelum = k0.querySelector('.kartu-bahas').hidden;
                tombol[0].click();
                const hasil = {
                    jumlah: kartu.length,
                    pilihanPerKartu: tombol.length,
                    bahasSebelum: bahasSebelum,
                    bahasSesudah: k0.querySelector('.kartu-bahas').hidden,
                    adaYangBenar: !!k0.querySelector('.pilih.benar'),
                    terkunci: Array.from(tombol).every((b) => b.disabled),
                    hitung: document.getElementById('contoh-hitung').textContent,
                    teksBahas: (k0.querySelector('.bahas-isi') || {}).textContent || ''
                };
                hasil.klikKeduaTidakMenambah = false;
                tombol[0].click();
                hasil.klikKeduaTidakMenambah = document.getElementById('contoh-hitung').textContent === hasil.hitung;
                return hasil;
            }""")
            cek(c['jumlah'] >= 40, '/contoh/: 40 soal gratis termuat', c['jumlah'])
            cek(c['pilihanPerKartu'] >= 4, '/contoh/: tiap soal punya 4 pilihan', c['pilihanPerKartu'])
            cek(c['bahasSebelum'] and not c['bahasSesudah'] and len(c['teksBahas']) > 40,
                '/contoh/: pembahasan terbuka setelah menjawab', c['teksBahas'][:60])
            cek(c['adaYangBenar'] and c['terkunci'], '/contoh/: jawaban benar ditandai dan pilihan terkunci', c)
            cek('1 dari' in c['hitung'] and c['klikKeduaTidakMenambah'],
                '/contoh/: penghitung jawaban jalan dan tidak menghitung dua kali', c['hitung'])
            saring = page.evaluate("""() => {
                const s = document.getElementById('contoh-jenis');
                s.value = 'verbal';
                s.dispatchEvent(new Event('change'));
                const n = document.querySelectorAll('.kartu-soal').length;
                const semua = document.querySelectorAll('.kartu-soal[data-kunci="verbal"]').length;
                s.value = '';
                s.dispatchEvent(new Event('change'));
                return { n: n, semua: semua, lagi: document.querySelectorAll('.kartu-soal').length };
            }""")
            cek(saring['n'] == saring['semua'] == 5 and saring['lagi'] >= 40,
                '/contoh/: penapis jenis tes menyaring 5 soal dan bisa dikembalikan', saring)
            taut = page.evaluate("""() => {
                const a = Array.from(document.querySelectorAll('a'));
                return {
                    keBeli: a.some((x) => (x.getAttribute('href') || '').indexOf('../beli/') >= 0),
                    keAplikasi: a.some((x) => (x.getAttribute('href') || '') === '../'),
                    keMutu: a.some((x) => (x.getAttribute('href') || '').indexOf('../mutu/') >= 0)
                };
            }""")
            cek(taut['keBeli'] and taut['keAplikasi'] and taut['keMutu'],
                '/contoh/: ada jalan ke halaman beli, aplikasi, dan bukti mutu', taut)
            # Bilah hasil + ajakan berbagi. Satu-satunya jalur penyebaran yang tidak butuh akun:
            # pembaca sendiri yang mengirim tautannya, dan halaman tidak pernah mengirim pesan
            # atas nama siapa pun. Yang diuji: bilah tidak muncul sebelum ada jawaban, angkanya
            # sama dengan jawaban benar, tautannya WhatsApp berisi skor + alamat halaman, tetap
            # tanpa pelanggaran aksesibilitas / geser horizontal saat tampil, dan tersembunyi lagi
            # setelah "Mulai ulang".
            page.goto('http://127.0.0.1:%d/contoh/' % PORT, wait_until='load', timeout=45000)
            page.wait_for_timeout(400)
            awal = page.evaluate("""() => ({
                tampil: getComputedStyle(document.getElementById('contoh-hasil')).display !== 'none',
                bagi: document.getElementById('contoh-bagi').getAttribute('href') })""")
            cek(not awal['tampil'], '/contoh/: bilah hasil tersembunyi sebelum ada jawaban', awal)
            bilah = page.evaluate("""async () => {
                const kartu = document.querySelectorAll('.kartu-soal');
                for (let i = 0; i < 5; i++) {
                    kartu[i].querySelectorAll('.pilih')[window.CONTOH_SOAL[i].j].click();
                }
                const el = document.getElementById('contoh-hasil');
                const a = axe.run(document, { runOnly: ['wcag2a','wcag2aa','wcag21a','wcag21aa'] });
                const r = await a;
                return {
                    tampil: getComputedStyle(el).display !== 'none',
                    angka: document.getElementById('contoh-hasil-angka').textContent.trim(),
                    kata: document.getElementById('contoh-hasil-kata').textContent.trim(),
                    bagi: document.getElementById('contoh-bagi').getAttribute('href') || '',
                    padat: document.body.classList.contains('ada-hasil'),
                    axe: r.violations.map(v => v.id + '(' + v.nodes.length + ')'),
                    isi: document.documentElement.scrollWidth, layar: window.innerWidth,
                    ukuran: Array.from(el.querySelectorAll('.tombol'))
                        .map(x => Math.round(x.getBoundingClientRect().height))
                };
            }""")
            cek(bilah['tampil'] and bilah['angka'] == '5/5' and bilah['padat'],
                '/contoh/: bilah hasil muncul dengan skor jawaban benar', [bilah['angka'], bilah['kata']])
            cek(bilah['bagi'].startswith('https://wa.me/?text='),
                '/contoh/: tombol bagikan menuju WhatsApp', bilah['bagi'][:60])
            kirim = urllib.parse.unquote(bilah['bagi'])
            cek('5 dari 5' in kirim and 'https://siappsikotes.my.id/contoh/' in kirim,
                '/contoh/: pesan bagikan memuat skor dan alamat halaman', kirim[:160])
            cek(not bilah['axe'] and bilah['isi'] <= bilah['layar'] + 1,
                '/contoh/: bilah hasil tampil tanpa pelanggaran WCAG / geser horizontal',
                [bilah['axe'], bilah['isi'], bilah['layar']])
            cek(all(h >= 38 for h in bilah['ukuran']),
                '/contoh/: tombol bilah hasil nyaman disentuh (>=38px)', bilah['ukuran'])
            page.click('#contoh-ulang')
            page.wait_for_timeout(300)
            ulang2 = page.evaluate("""() => ({
                tampil: getComputedStyle(document.getElementById('contoh-hasil')).display !== 'none',
                hitung: document.getElementById('contoh-hitung').textContent })""")
            cek(not ulang2['tampil'] and ulang2['hitung'].startswith('0 dari'),
                '/contoh/: mulai ulang menyembunyikan bilah hasil', ulang2)
            # Gerbang kode akses adalah satu-satunya langkah pembeli SETELAH membayar, dan
            # belum pernah dijalankan di peramban sungguhan. Kode yang dibuat tools/buat-kode.py
            # harus benar-benar membuka aplikasi; kalau tidak, pembayaran masuk dan pembeli
            # tetap terkunci. Diuji lewat konteks baru supaya simpanan perangkat bersih.
            print('== /: gerbang kode akses (langkah setelah membayar) ==')
            kode_sah = None
            try:
                import importlib.util
                _spec = importlib.util.spec_from_file_location(
                    'buat_kode', os.path.join(AKAR, 'tools', 'buat-kode.py'))
                _mod = importlib.util.module_from_spec(_spec)
                _spec.loader.exec_module(_mod)
                kode_sah = _mod.buat_kode('PENGUJIAN')
                if not _mod.periksa(kode_sah):
                    kode_sah = None
            except Exception as e:
                print('  LEWAT | tools/buat-kode.py tidak bisa dijalankan (%s)' % str(e)[:120])
            if kode_sah:
                gctx = browser.new_context(viewport={'width': 1280, 'height': 900})
                gpage = gctx.new_page()
                galat_gerbang = []
                gpage.on('pageerror', lambda e: galat_gerbang.append(str(e)[:150]))
                gpage.goto('http://127.0.0.1:%d/' % PORT, wait_until='load', timeout=45000)
                gpage.wait_for_timeout(700)
                g1 = gpage.evaluate("""() => ({
                    kartu: !!document.querySelector('.komer-kartu'),
                    kolom: !!document.getElementById('kodeAksesGerbang'),
                    isiAplikasi: document.querySelectorAll('#main .card').length,
                    akun: !!document.getElementById('pfNama')
                })""")
                cek(g1['kartu'] and g1['kolom'] and g1['isiAplikasi'] == 0 and not g1['akun'],
                    '/: aplikasi terkunci sebelum kode dimasukkan', g1)
                gpage.fill('#kodeAksesGerbang', 'SPXXXXXX')
                gpage.click('.komer-kartu button:has-text("Buka")')
                gpage.wait_for_timeout(300)
                pesan_salah = gpage.inner_text('#statusGerbang')
                cek('tidak dikenali' in pesan_salah.lower(),
                    '/: kode salah ditolak dengan pesan yang bisa ditindaklanjuti', pesan_salah[:80])
                gpage.fill('#kodeAksesGerbang', kode_sah)
                gpage.click('.komer-kartu button:has-text("Buka")')
                try:
                    gpage.wait_for_function(
                        "() => !document.querySelector('.komer-kartu')", timeout=20000)
                except Exception:
                    pass
                gpage.wait_for_timeout(400)
                g2 = gpage.evaluate("""() => ({
                    kartu: !!document.querySelector('.komer-kartu'),
                    tersimpan: localStorage.getItem('tni_akses'),
                    kode: localStorage.getItem('tni_kode_akses'),
                    kartuIsi: document.querySelectorAll('#main .card').length,
                    akun: !!document.getElementById('pfNama'),
                    panjang: ((document.getElementById('main') || {}).innerText || '').length
                })""")
                cek(not g2['kartu'] and g2['tersimpan'] == 'TERBUKA'
                    and g2['kode'] == kode_sah.upper(),
                    '/: kode buatan pemilik membuka aplikasi', g2)
                cek(g2['kartuIsi'] > 0 and g2['akun'] and g2['panjang'] > 1000,
                    '/: isi aplikasi benar-benar tampil setelah kode diterima',
                    [g2['kartuIsi'], g2['akun'], g2['panjang']])
                cek(not galat_gerbang, '/: tanpa galat JavaScript di gerbang akses', galat_gerbang[:2])
                gctx.close()
            # Kode akses kini dibuat halaman /beli/ sendiri sesudah pembeli menekan
            # "Tampilkan kode akses". Kalau sidik di halaman beli tidak sama dengan sidik
            # aplikasi, pembeli membayar lalu tetap terkunci - jadi kode dari halaman itu
            # diuji sampai benar-benar membuka aplikasi, bukan cuma sampai tampil.
            print('== /beli/ -> /: kode buatan halaman beli membuka aplikasi ==')
            bctx = browser.new_context(viewport={'width': 1280, 'height': 900})
            bpage = bctx.new_page()
            galat_kode = []
            bpage.on('pageerror', lambda e: galat_kode.append(str(e)[:150]))
            try:
                bpage.goto('http://127.0.0.1:%d/beli/' % PORT, wait_until='load', timeout=45000)
                bpage.wait_for_timeout(600)
                bpage.click('#beliAmbilKode')
                bpage.wait_for_timeout(250)
                bk = bpage.evaluate("""() => {
                    var el = document.getElementById('beliKodeAkses');
                    var salin = document.getElementById('beliSalinKode');
                    var ambil = document.getElementById('beliAmbilKode');
                    var buka = document.getElementById('beliBukaKode');
                    var wa = document.getElementById('beliBukti');
                    return {
                        kode: (el && el.textContent || '').trim(),
                        tampil: !!el && getComputedStyle(el).display !== 'none',
                        salinTampil: !!salin && getComputedStyle(salin).display !== 'none',
                        ambilSembunyi: !!ambil && getComputedStyle(ambil).display === 'none',
                        tautanBuka: !!buka && (buka.getAttribute('href') || ''),
                        tautanBukaTampil: !!buka && getComputedStyle(buka).display !== 'none',
                        pesanWa: decodeURIComponent(((wa && wa.getAttribute('href')) || '').split('text=')[1] || ''),
                        rujukan: (document.getElementById('beliRujukan') || {}).textContent || ''};
                }""")
                cek(bk['tampil'] and bool(re.match(r'^SP[A-Z0-9]{6,}$', bk['kode'])),
                    '/beli/: tombol menampilkan kode akses berformat SP', bk['kode'][:14])
                cek(bk['salinTampil'] and bk['ambilSembunyi'],
                    '/beli/: tombol salin muncul, tombol ambil tidak dobel', [bk['salinTampil'], bk['ambilSembunyi']])
                # Satu klik dari bayar ke aplikasi: kode dibawa di alamat halaman aplikasi.
                # Langkah inilah yang tadinya menuntut pembeli menyalin lalu menempel sendiri.
                cek(bk['tautanBukaTampil'] and ('kode=' + bk['kode']) in bk['tautanBuka'],
                    '/beli/: tombol buka aplikasi membawa kode akses di alamat', bk['tautanBuka'][:70])
                cek('kirim kode aksesnya' not in bk['pesanWa'].lower(),
                    '/beli/: pesan WhatsApp tidak lagi menunggu kiriman kode akses', bk['pesanWa'][:90])
                angka = re.sub(r'[^0-9]', '', bk['rujukan'])[-3:]
                cek(angka and angka in bk['kode'],
                    '/beli/: kode akses dapat ditelusuri ke kode rujukan pembeli', [bk['rujukan'], bk['kode'][:14]])
                pemeriksa_siap = False
                sah_kode = False
                try:
                    import importlib.util
                    _spec2 = importlib.util.spec_from_file_location(
                        'buat_kode2', os.path.join(AKAR, 'tools', 'buat-kode.py'))
                    _mod2 = importlib.util.module_from_spec(_spec2)
                    _spec2.loader.exec_module(_mod2)
                    sah_kode = bool(_mod2.periksa(bk['kode']))
                    pemeriksa_siap = True
                except Exception as e:
                    print('  LEWAT | pemeriksa kode tidak bisa dijalankan (%s)' % str(e)[:120])
                if pemeriksa_siap:
                    cek(sah_kode, '/beli/: kode buatan halaman beli lolos pemeriksa resmi repo', bk['kode'][:14])
                bpage.goto('http://127.0.0.1:%d/' % PORT, wait_until='load', timeout=45000)
                bpage.wait_for_timeout(700)
                bpage.fill('#kodeAksesGerbang', bk['kode'])
                bpage.click('.komer-kartu button:has-text("Buka")')
                try:
                    bpage.wait_for_function(
                        "() => !document.querySelector('.komer-kartu')", timeout=20000)
                except Exception:
                    pass
                bpage.wait_for_timeout(400)
                b3 = bpage.evaluate("""() => ({
                    kartu: !!document.querySelector('.komer-kartu'),
                    tersimpan: localStorage.getItem('tni_akses'),
                    isi: document.querySelectorAll('#main .card').length })""")
                cek(not b3['kartu'] and b3['tersimpan'] == 'TERBUKA' and b3['isi'] > 0,
                    '/beli/: kode dari halaman beli membuka aplikasi tanpa bantuan pengelola', b3)
                cek(not galat_kode, '/beli/: tanpa galat JavaScript di alur kode akses', galat_kode[:2])
                # Tautannya sendiri yang diuji, di konteks peramban yang bersih: pembeli yang
                # membayar lalu menekan satu tombol harus langsung masuk, bukan sekadar melihat
                # tautan yang tampak benar di halaman.
                print('== /beli/ -> /?kode=: satu klik membuka aplikasi ==')
                dctx = browser.new_context(viewport={'width': 1280, 'height': 900})
                dpage = dctx.new_page()
                galat_tautan = []
                dpage.on('pageerror', lambda e: galat_tautan.append(str(e)[:150]))
                dpage.goto('http://127.0.0.1:%d/?kode=%s' % (PORT, bk['kode']),
                           wait_until='load', timeout=45000)
                try:
                    dpage.wait_for_function(
                        "() => !document.querySelector('.komer-kartu')", timeout=20000)
                except Exception:
                    pass
                dpage.wait_for_timeout(400)
                d4 = dpage.evaluate("""() => ({
                    kartu: !!document.querySelector('.komer-kartu'),
                    tersimpan: localStorage.getItem('tni_akses'),
                    kode: localStorage.getItem('tni_kode_akses'),
                    isi: document.querySelectorAll('#main .card').length,
                    alamat: location.search })""")
                cek(not d4['kartu'] and d4['tersimpan'] == 'TERBUKA'
                    and d4['kode'] == bk['kode'].upper() and d4['isi'] > 0,
                    '/beli/: satu klik tautan kode langsung membuka aplikasi', d4)
                cek(d4['alamat'] == '',
                    '/beli/: kode akses tidak tertinggal di alamat peramban', d4['alamat'][:60])
                cek(not galat_tautan, '/beli/: tanpa galat JavaScript di tautan kode', galat_tautan[:2])
                dctx.close()
            except Exception as e:
                cek(False, '/beli/: alur ambil kode akses berjalan di peramban sungguhan', str(e)[:140])
            bctx.close()
            cek(not galat, 'tanpa galat JavaScript di halaman pendukung', galat[:3])
            # /favicon.ico diminta peramban sendiri, tanpa membaca <link rel="icon">
            try:
                with urllib.request.urlopen('http://127.0.0.1:%d/favicon.ico' % PORT, timeout=15) as r:
                    status_ico, isi_ico = r.status, r.read()
            except Exception as e:
                status_ico, isi_ico = 0, str(e).encode()
            jumlah_ico = int.from_bytes(isi_ico[4:6], 'little') if len(isi_ico) >= 6 else 0
            cek(status_ico == 200 and isi_ico[:4] == b'\x00\x00\x01\x00' and jumlah_ico >= 2,
                '/favicon.ico: ICO asli di akar situs, >= 2 ukuran',
                [status_ico, isi_ico[:4], jumlah_ico])
            # /llms.txt: dibaca mesin pencari AI, yang datang tanpa akun dan tanpa peringkat Google.
            # Tautan yang tidak ada berkasnya akan membuat mesin itu menyebut halaman 404.
            try:
                with urllib.request.urlopen('http://127.0.0.1:%d/llms.txt' % PORT, timeout=15) as r:
                    status_llms, isi_llms = r.status, r.read().decode('utf-8', 'replace')
            except Exception as e:
                status_llms, isi_llms = 0, str(e)
            cek(status_llms == 200 and 0 < len(isi_llms) <= 8192,
                '/llms.txt: tersaji di akar situs dan ringkas', [status_llms, len(isi_llms)])
            tautan = sorted(set(re.findall(r'https://siappsikotes\.my\.id(/[^)\s]*)', isi_llms)))
            hilang = [t for t in tautan
                      if not os.path.exists(os.path.join(AKAR, t.strip('/'), 'index.html'))
                      and not os.path.exists(os.path.join(AKAR, t.strip('/')))]
            cek(bool(tautan) and not hilang,
                '/llms.txt: setiap tautan menunjuk berkas yang benar-benar ada',
                [len(tautan), hilang[:3]])
            cek('Rp 39.000' in isi_llms and '1.348 soal' in isi_llms
                and 'bukan situs resmi instansi mana pun' in isi_llms,
                '/llms.txt: harga, jumlah soal, dan penyangkalan afiliasi sesuai kenyataan situs',
                ['Rp 39.000' in isi_llms, '1.348 soal' in isi_llms])
            browser.close()
    finally:
        httpd.shutdown()

    gagal = [h for h in hasil if not h[0]]
    print()
    print('HASIL TAMPILAN: %d lulus, %d gagal' % (len(hasil) - len(gagal), len(gagal)))
    if RUSAK:
        if gagal:
            print('SANITY: uji menangkap kerusakan yang disuntikkan (%d gagal) - uji ini mengukur' % len(gagal))
            return 0
        print('SANITY GAGAL: harapan yang sengaja salah tetap lolos - uji ini tidak mengukur apa pun')
        return 1
    return 1 if gagal else 0


if __name__ == '__main__':
    sys.exit(main())

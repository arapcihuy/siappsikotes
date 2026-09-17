#!/usr/bin/env python3
"""Uji sinkronisasi database — dikemudikan dari sisi Python, dengan bukti bisa-gagal.

Dua pelajaran mahal yang dipakai di sini:
  1. Jangan menunggu janji di dalam halaman (timer halaman bisa ditunda -> janji tidak selesai).
     Jalankan tindakannya, lalu tunggu KEADAANNYA lewat wait_for_function dari Python.
  2. Setiap uji WAJIB dibuktikan bisa gagal. Jalankan:  --rusak  (sengaja mematahkan harapan),
     dan uji itu harus melaporkan GAGAL. Bila tetap "lulus", ujinya tidak mengukur apa pun.

Pemakaian:
  /usr/bin/python3 tools/uji-sinkron-db.py            # jalankan pengujian
  /usr/bin/python3 tools/uji-sinkron-db.py --rusak     # bukti uji ini bisa gagal
"""
import functools
import http.server
import os
import socket
import sys
import threading
from playwright.sync_api import sync_playwright

RUSAK = '--rusak' in sys.argv
APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
s = socket.socket(); s.bind(('127.0.0.1', 0)); port = s.getsockname()[1]; s.close()
h = functools.partial(http.server.SimpleHTTPRequestHandler, directory=APP)


class P(http.server.ThreadingHTTPServer):
    daemon_threads = True


httpd = P(('127.0.0.1', port), h)
threading.Thread(target=httpd.serve_forever, daemon=True).start()

lulus = gagal = 0


def cek(nama, syarat, bukti=''):
    """PENTING: argumen pertama NAMA, kedua SYARAT."""
    global lulus, gagal
    if syarat:
        lulus += 1
        print('  OK    | %s' % nama)
    else:
        gagal += 1
        print('  GAGAL | %s  ->  %s' % (nama, str(bukti)[:170]))


TIRUAN = """() => {
    window.__dikirim = [];
    const isiApi = {
        '/api/masuk': { token: 'sesi-uji-123', pengguna: { surel: 'pembeli@contoh.id' } },
        '/api/ruang/masuk': { token: 'sesi-ruang-77', pengguna: { surel: 'kode:SPUJICOBAA4D3' } },
        '/api/saya': { progres: [{ kategori: 'tkw', benar: 11, salah: 4 }],
                       salah: [{ id_soal: 'w9' }],
                       bahan: [{ jenis: 'catatan', kunci: 'tni_wawancara', isi: '{"a":1}' }],
                       pembelian: [{ kode: 'SPUJI123', rujukan: 'SP-123', nominal: 39123, tanggal: '2026-09-13' }] },
        '/api/pemilik/ringkasan': { total_pengguna: 3, aktif_hari_ini: 2,
            pengguna: [{ surel: 'a@b.c', terakhir_aktif: '2026-09-13T10:00:00Z',
                         total_benar: 20, total_salah: 5, jumlah_pembelian: 1 }] }
    };
    window.fetch = (u, o) => {
        const a = String(u).replace('https://siappsikotes-api.rasyidahmad180.workers.dev', '').split('?')[0];
        const tajuk = ((o && o.headers) || {}).Authorization || '';
        window.__dikirim.push(a + '|' + ((o && o.method) || 'GET') + '|' + tajuk);
        return Promise.resolve({ ok: true, json: () => Promise.resolve(isiApi[a] || { ok: true }) });
    };
}"""

with sync_playwright() as p:
    b = p.chromium.launch(channel='chrome')
    page = b.new_page(viewport={'width': 1200, 'height': 900})
    page.goto('http://127.0.0.1:%d/index.html' % port, wait_until='domcontentloaded', timeout=40000)
    page.wait_for_function('() => window.DATA_SOAL_INDEX && window.DATA_SOAL_INDEX.total > 0', timeout=40000)
    page.evaluate("() => { try { localStorage.clear(); localStorage.setItem('tni_akses_pemilik','1'); } catch (e) {} }")

    # tiruan dipasang dan DIPERIKSA benar-benar aktif sebelum menguji apa pun
    page.evaluate(TIRUAN)
    tiruan_aktif = page.evaluate("() => (typeof window.__dikirim === 'object') && (typeof window.fetch === 'function')")
    print('=== Uji sinkronisasi database%s ===' % (' (MODE RUSAK - harus ada yang GAGAL)' if RUSAK else ''))
    cek('tiruan API terpasang & aktif (bila tidak, uji ini tidak mengukur apa pun)', tiruan_aktif,
        page.evaluate("() => typeof window.__dikirim"))
    if not tiruan_aktif:
        b.close(); httpd.shutdown()
        print('\nHASIL: tiruan tidak terpasang - pengujian dibatalkan')
        sys.exit(1)

    # 1. masuk -> tunggu keadaan sesi tersimpan
    page.evaluate("() => { dbMasuk('id-token-uji'); }")
    try:
        page.wait_for_function("() => localStorage.getItem('tni_sesi_db') === 'sesi-uji-123'", timeout=15000)
        sesi_ok = True
    except Exception:
        sesi_ok = False
    tukar = page.evaluate("() => (window.__dikirim || []).some(x => x.indexOf('/api/masuk|POST') === 0)")
    otorisasi = page.evaluate("""() => (window.__dikirim || []).filter(x => x.split('|')[1] === 'POST'
            && x.indexOf('/api/masuk') !== 0)   // /api/masuk memang belum bersesi
        .every(x => x.split('|')[2].indexOf('Bearer sesi-uji-123') >= 0)""")
    cek('masuk menukar token Google ke sesi & kiriman membawa otorisasi',
        tukar and sesi_ok and otorisasi,
        {'tukar': tukar, 'sesi': sesi_ok, 'otorisasi': otorisasi})

    # 2. tarik -> tunggu data diterapkan
    try:
        page.wait_for_function("() => !!localStorage.getItem('tni_kode_akses')", timeout=15000)
        tarik_ok = True
    except Exception:
        tarik_ok = False
    isi = page.evaluate("""() => ({ prog: !!localStorage.getItem('tni_prog'),
        salah: !!localStorage.getItem('tni_wrong'), bahan: !!localStorage.getItem('tni_wawancara'),
        kode: localStorage.getItem('tni_kode_akses') })""")
    if RUSAK:
        isi['kode'] = 'SENGAJA-DIPUTUS'
    cek('data ditarik ke perangkat (progres, soal salah, bahan, kode akses)',
        tarik_ok and isi['prog'] and isi['salah'] and isi['bahan'] and isi['kode'] == 'SPUJI123', isi)

    # 3. dorong -> tunggu terkirim
    page.evaluate("""() => { localStorage.setItem('tni_prog', JSON.stringify({ tkw: { benar: 3, salah: 1 } }));
                            jadwalkanDorong(); }""")
    try:
        page.wait_for_function("() => (window.__dikirim || []).some(x => x.indexOf('/api/progres') === 0)", timeout=15000)
        dorong_ok = True
    except Exception:
        dorong_ok = False
    cek('perubahan lokal otomatis didorong ke database', dorong_ok,
        page.evaluate("() => (window.__dikirim || []).filter(x => x.indexOf('/api/progres') === 0).length"))

    # 4. dasbor pemilik
    page.evaluate("() => { navTo('pemilik'); muatDasborPemilik(); }")
    try:
        page.wait_for_function("() => document.body.innerText.indexOf('Total pengguna') >= 0", timeout=15000)
        dasbor_ok = True
    except Exception:
        dasbor_ok = False
    try:
        page.wait_for_function("() => document.body.innerText.indexOf('a@b.c') >= 0", timeout=10000)
        ada_baris = True
    except Exception:
        ada_baris = False
    teks = page.evaluate("() => { const t = document.body.innerText.replace(/\\s+/g, ' '); const i = t.indexOf('Total pengguna'); return i < 0 ? t.slice(0, 110) : t.slice(i, i + 110); }")
    cek('dasbor pemilik memuat ringkasan pengguna dari database', dasbor_ok and ada_baris, teks)

    # 4b. masuk dengan kode akses -> sesi ruang tersimpan, endpoint dipanggil, kiriman pakai sesi ruang
    page.evaluate("() => { window.__dikirim.length = 0; window.dbMasukKode('SPUJICOBAA4D3'); }")
    try:
        page.wait_for_function("() => localStorage.getItem('tni_sesi_db') === 'sesi-ruang-77'", timeout=15000)
        ruang_sesi = True
    except Exception:
        ruang_sesi = False
    ruang_dipanggil = page.evaluate("() => (window.__dikirim || []).some(x => x.indexOf('/api/ruang/masuk|POST') === 0)")
    try:
        page.wait_for_function("() => (window.__dikirim || []).some(x => x.indexOf('/api/progres|POST') === 0 && x.indexOf('Bearer sesi-ruang-77') >= 0)", timeout=15000)
        ruang_bearer = True
    except Exception:
        ruang_bearer = False
    if RUSAK:
        ruang_sesi = False
    cek('kode akses menyambung ruang: sesi ruang tersimpan & progres ikut terkirim',
        ruang_sesi and ruang_dipanggil and ruang_bearer,
        {'sesi': ruang_sesi, 'panggil': ruang_dipanggil, 'bearer': ruang_bearer})

    # 5. jaringan mati -> hasil aman
    page.evaluate("""() => { window.__hasilOffline = 'menunggu';
        window.fetch = () => Promise.reject(new Error('jaringan mati'));
        dbDorongSekarang(true).then(function (r) { window.__hasilOffline = r; },
                                    function () { window.__hasilOffline = 'ditolak'; }); }""")
    try:
        page.wait_for_function("() => window.__hasilOffline !== 'menunggu'", timeout=15000)
        offline_ok = True
    except Exception:
        offline_ok = False
    offline = page.evaluate("() => ({ hasil: window.__hasilOffline, hidup: !!document.getElementById('main') })")
    cek('jaringan mati: sinkronisasi gagal dengan aman & aplikasi tetap jalan',
        offline_ok and offline['hasil'] is False and offline['hidup'], offline)

    b.close()
httpd.shutdown()

print('\nHASIL: %d lulus, %d gagal' % (lulus, gagal))
if RUSAK:
    # mode rusak: bila semuanya tetap "lulus", ujinya memang tidak mengukur apa pun
    if gagal == 0:
        print('BUKTI GAGAL: mode rusak seharusnya memunculkan kegagalan - uji ini tidak sah')
        sys.exit(1)
    print('BUKTI BERHASIL: uji ini memang bisa gagal (mode rusak memunculkan %d kegagalan)' % gagal)
    sys.exit(0)
sys.exit(1 if gagal else 0)

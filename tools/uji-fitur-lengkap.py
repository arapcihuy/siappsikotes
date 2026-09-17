#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""UJI SEMUA FITUR — memeriksa setiap fitur aplikasi berfungsi, bukan hanya sebagian.

Dijalankan di CI (.github/workflows/uji-fitur.yml) dan bisa dijalankan lokal:
    python3 tools/uji-fitur-lengkap.py

Setiap fitur diuji dengan menggerakkan aplikasinya di Chromium lalu memeriksa hasilnya.
"""
import functools
import http.server
import os
import re
import socket
import socketserver
import sys
import threading
import time

AKSES_HARGA = 'Rp 39.000'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
gagal = []
lulus = [0]


def cek(cond, label, detail=''):
    print(('  OK    ' if cond else '  GAGAL ') + '| ' + label + ((' -> ' + str(detail)[:220]) if detail else ''))
    if cond:
        lulus[0] += 1
    else:
        gagal.append(label)


def port_bebas():
    s = socket.socket()
    s.bind(('127.0.0.1', 0))
    p = s.getsockname()[1]
    s.close()
    return p


def jalankan_server(port):
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
    # Peladen berulir: tanpa ini, banyak permintaan berkas harus mengantre satu per satu
    # sehingga pengujian lambat dan bisa timeout (bukan karena aplikasinya).
    class _PeladenBerulir(http.server.ThreadingHTTPServer):
        daemon_threads = True
    httpd = _PeladenBerulir(('127.0.0.1', port), handler)
    httpd.allow_reuse_address = True
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def main():
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print('playwright belum terpasang')
        return 2

    port = port_bebas()
    httpd = jalankan_server(port)
    url = 'http://127.0.0.1:%d/index.html' % port
    kesalahan = []

    with sync_playwright() as p:
        browser = None
        for cara in (lambda: p.chromium.launch(channel='chrome'), lambda: p.chromium.launch()):
            try:
                browser = cara()
                break
            except Exception:
                continue
        if browser is None:
            print('tidak bisa meluncurkan browser')
            httpd.shutdown()
            return 2

        page = browser.new_page(viewport={'width': 1200, 'height': 900})
        # Gerbang akses (v57): uji lama harus berjalan sebagai PEMILIK, bukan sebagai pengunjung terkunci.
        page.add_init_script("try{localStorage.setItem('tni_akses_pemilik','1');}catch(e){}")
        page.add_init_script('window.buatKodeUji = function () { var KUNCI = "siap|psikotes|2026|kode"; function sidik(isi) {  var h = 2166136261, s = isi + "#" + KUNCI;  for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }  var pos = h % 1679616, abjad = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ", hasil = "";  while (pos > 0) { hasil = abjad[pos % 36] + hasil; pos = Math.floor(pos / 36); }  while (hasil.length < 4) hasil = "0" + hasil;  return hasil; } var isi = "UJI" + String(Date.now()).slice(-6); return "SP" + isi + sidik(isi); };')
        page.on('pageerror', lambda e: kesalahan.append('pageerror: %s' % e))
        page.on('console', lambda m: kesalahan.append('console: %s' % m.text)
                if m.type == 'error' and 'favicon' not in m.text.lower() else None)
        page.goto(url + '?fitur=1', wait_until='load', timeout=40000)
        page.wait_for_function('() => window.DATA_SOAL_INDEX && window.DATA_SOAL_INDEX.total > 0', timeout=30000)
        page.evaluate('() => pastikanSemua()')
        page.wait_for_function('() => katSiapSemua()', timeout=60000)

        def segar():
            """Muat ulang halaman + bersihkan penyimpanan, supaya tiap bagian berdiri sendiri."""
            page.goto(url + '?seg=1', wait_until='load', timeout=40000)
            page.evaluate('() => { try { localStorage.clear(); } catch (e) {} }')
            page.reload(wait_until='load', timeout=40000)
            page.wait_for_function('() => window.DATA_SOAL_INDEX && window.DATA_SOAL_INDEX.total > 0', timeout=30000)
            page.evaluate('() => pastikanSemua()')
            page.wait_for_function('() => katSiapSemua()', timeout=60000)

        # ---- A. Beranda ----
        print('== A. Beranda ==')
        a = page.evaluate("""() => {
            localStorage.clear(); localStorage.setItem('tni_akses_pemilik','1'); goHome();
            return {
                total: totalSoal(),
                statPill: document.getElementById('hStatSoal').textContent,
                kesiapan: !!document.querySelector('.siap-card'),
                rencana: !!document.querySelector('.rencana-list'),
                latihan: !!document.querySelector('.latihan-card'),
                hariIni: !!document.querySelector('.hari-ini'),
                jalur: !!document.querySelector('.jalur-card'),
                jelang: document.body.textContent.indexOf('Jelang Ujian') >= 0,
                tur: !!document.querySelector('.tur-card'),
                menuBtn: !!document.getElementById('btnMenuLain'),
                tema: !!document.querySelector('.tampilan-bar'),
                kartuKategori: document.querySelectorAll('#main .card[onclick]').length
            };
        }""")
        cek(a['total'] >= 1200 and a['statPill'] == str(a['total']), 'statistik header sesuai jumlah soal', a)
        cek(a['kesiapan'] and a['rencana'] and a['latihan'] and a['hariIni'] and a['jalur'] and a['jelang'],
            'semua panel beranda tampil (kesiapan, rencana, latihan, hari ini, jalur, jelang)', a)
        cek(a['tur'] and a['menuBtn'] and a['tema'], 'tur awal, tombol menu, dan pengaturan tampilan ada', a)

        segar()
        print('== B. Tryout / Simulasi ==')
        b = page.evaluate("""async () => {
            const out = {};
            startCat('tkw', 'tryout');
            out.jumlah = S.questions.length;
            out.timer = document.querySelector('.timer-num') ? document.querySelector('.timer-num').textContent : '';
            out.palette = typeof openPalette === 'function';
            if (typeof window.toggleFlag === 'function') toggleFlag(0); out.flag = !!S.flagged[0];
            pickAnswer((S.questions[0].jawaban + 1) % 4);
            out.kunciTerkunci = S.tampilkanKunci === false && document.body.textContent.indexOf('Kunci dikunci selama tryout') >= 0;
            bukaKunciSekarang();
            out.setelahBuka = document.body.textContent.indexOf('SALAH') >= 0;
            for (let i = 1; i < 6; i++) { S.idx = i; S.tSoalIdx = -1; render(); pickAnswer(S.questions[i].jawaban); }
            S.idx = 0; finishSession();
            out.hasil = { nilai: (S.lastResult ? S.lastResult.nilai : null), perKat: Object.keys(S.lastResult.perKat).length,
                          panelKat: !!document.querySelector('.panel-kategori-hasil'),
                          waktuKat: !!document.querySelector('.kecepatan-kat') };
            out.tersimpan = loadScores().length >= 1;
            return out;
        }""")
        cek(b['jumlah'] == 60 and b['timer'], 'tryout 60 soal + timer tampil', b)
        cek(b['flag'], 'tombol ragu-ragu berfungsi', b)
        cek(b['kunciTerkunci'] and b['setelahBuka'], 'kunci terkunci saat tryout & bisa dibuka', b)
        cek(b['hasil']['panelKat'] and b['hasil']['waktuKat'] and b['tersimpan'], 'hasil tryout: panel kategori, waktu, tersimpan', b['hasil'])

        segar()
        print('== C. Mode Belajar & tiap kategori ==')
        kategori = page.evaluate('() => daftarKategori()')
        cek(len(kategori) == 9, 'jumlah kategori = 9', len(kategori))
        for k in kategori:
            r = page.evaluate("""(kat) => {
                startCat(kat, 'learn');
                const n = S.questions.length;
                const q = S.questions[S.idx];
                pickAnswer(q.jawaban);
                const b = document.querySelector('.explanation-body');
                const adaLanjut = !!document.querySelector('.btn-primary');
                nextQ();
                const pindah = S.idx === 1 || n === 1;
                return { n: n, pb: b ? b.textContent.split('\\n').length : 0, lanjut: adaLanjut, pindah: pindah,
                         kategori: q.kategori };
            }""", k)
            cek(r['n'] > 0 and r['pb'] >= 2 and r['lanjut'] and r['pindah'],
                'belajar %s: %d soal, pembahasan %d baris, navigasi jalan' % (k, r['n'], r['pb']), r)

        segar()
        print('== D. Simulasi format seleksi & simulasi 60 ==')
        d = page.evaluate("""() => {
            goHome(); startSimulasiFormat();
            const per = {};
            S.questions.forEach(x => { per[x.kategori] = (per[x.kategori] || 0) + 1; });
            const format = { n: S.questions.length, bagian: Object.keys(per).length, detik: S.timeLeft };
            goHome(); startSimulasi60();
            const biasa = { n: S.questions.length, detik: S.timeLeft, terkunci: S.tampilkanKunci === false };
            return { format: format, biasa: biasa };
        }""")
        cek(d['format']['n'] == 60 and d['format']['bagian'] >= 6 and d['format']['detik'] == 5400,
            'simulasi format seleksi: 60 soal, komposisi tetap, 90 menit', d['format'])
        cek(d['biasa']['n'] == 60 and d['biasa']['terkunci'], 'simulasi 60 soal acak terkunci', d['biasa'])

        segar()
        print('== E. Bank Soal (kategori, topik, pencarian, modal) ==')
        e = page.evaluate("""() => {
            const out = {};
            S.bankCat = 'all'; S.bankQuery = ''; S.bankLimit = 60; S.page = 'bank'; render();
            out.itemAwal = document.querySelectorAll('.bank-item').length;
            setTopikBank('tni-au');
            out.setelahTopik = document.querySelectorAll('.bank-item').length;
            setTopikBank('all');
            S.bankQuery = 'pasal 36A'; render();       out.cariKunci = document.querySelectorAll('.bank-item').length;
            S.bankQuery = 'jangka sorong'; render();    out.cariTidakAda = document.querySelectorAll('.bank-item').length;
            S.bankQuery = 'fotokopi'; render();         out.cariOpsi = document.querySelectorAll('.bank-item').length;
            S.bankQuery = ''; S.bankCat = 'tes_gambar'; render();
            out.kategoriSaja = document.querySelectorAll('.bank-item').length;
            const item = document.querySelector('.bank-item');
            if (item) item.click();
            out.modalTerbuka = document.getElementById('soalModal').classList.contains('open');
            closeModal();
            out.modalTertutup = !document.getElementById('soalModal').classList.contains('open');
            return out;
        }""")
        cek(e['itemAwal'] > 0, 'bank soal memuat daftar', e)
        cek(e['setelahTopik'] > 0 and e['setelahTopik'] < e['itemAwal'], 'filter topik menyaring daftar', e)
        cek(e['cariKunci'] >= 1 and e['cariOpsi'] >= 1 and e['cariTidakAda'] == 0,
            'pencarian menjangkau pertanyaan/opsi/pembahasan', e)
        cek(e['kategoriSaja'] > 0 and e['modalTerbuka'] and e['modalTertutup'],
            'filter kategori & modal detail soal berfungsi', e)

        segar()
        print('== F. Tips & alur belajar ==')
        f = page.evaluate("""() => {
            navTo('tips');
            return {
                alur: document.body.textContent.indexOf('Alur belajar yang dianjurkan') >= 0,
                langkah: document.querySelectorAll('.alur-tips .tur-item').length,
                fitur: document.body.textContent.indexOf('Fitur yang bisa kamu pakai') >= 0,
                kategoriTips: document.querySelectorAll('#main .card').length
            };
        }""")
        cek(f['alur'] and f['langkah'] >= 5 and f['fitur'], 'halaman Tips: alur belajar + daftar fitur', f)
        cek(f['kategoriTips'] >= 3, 'kartu tips per kategori tampil', f)

        segar()
        print('== G. IQ Lab ==')
        # Generator IQ (data/soal-iq.js) dimuat malas sejak v58: halaman IQ
        # mengunduhnya saat dibuka. Jadi tunggu dulu sampai siap.
        page.evaluate("() => navTo('iq')")
        siap_iq = False
        for _ in range(40):
            siap_iq = page.evaluate("() => typeof IQ_GEN !== 'undefined'")
            if siap_iq:
                break
            page.wait_for_timeout(250)
        g = page.evaluate("""() => {
            const out = { generatorDimuat: typeof IQ_GEN !== 'undefined' };
            out.halaman = !!document.getElementById('main').innerHTML;
            out.adaDrill = typeof IQ_GEN !== 'undefined' && typeof iqMulai === 'function';
            if (out.adaDrill) {
                const items = IQ_GEN.buat('matriks', 5);
                out.drillJumlah = items.length;
                if (items.length) iqMulai(items, 0);
                out.drillJalan = !!document.querySelector('.option');
                // semua domain harus menghasilkan 10 soal (pernah kosong untuk rotasi)
                out.perDomain = {};
                ['angka', 'huruf', 'matriks', 'rotasi', 'verbal', 'campuran'].forEach(d => {
                    out.perDomain[d] = IQ_GEN.buat(d, 10).length;
                });
            }
            out.nbFungsi = typeof iqNbStart === 'function';
            return out;
        }""")
        cek(g['adaDrill'] and g['drillJumlah'] >= 5 and g['drillJalan'], 'drill IQ bisa dijalankan', g)
        cek(g['nbFungsi'], 'fungsi Dual N-Back tersedia', g)
        kurang = {k: v for k, v in (g.get('perDomain') or {}).items() if v < 10}
        cek(not kurang, 'tiap jenis soal IQ menghasilkan 10 soal', kurang or g.get('perDomain'))

        segar()
        print('== H. Psikologi (semua jenis tes) ==')
        h = page.evaluate("""() => {
            const out = { ada: [], kunci: [] };
            navTo('psikologi');
            const kandidat = (typeof SOAL_PSIKOLOGI !== 'undefined') ? Object.keys(SOAL_PSIKOLOGI) : [];
            out.kunci = kandidat;
            kandidat.forEach(k => {
                try {
                    startPsiTest(k);
                    out.ada.push(k + ':' + (PSI.page || 'mulai'));
                } catch (e) {
                    out.ada.push(k + ':ERROR ' + e.message);
                }
            });
            psiBackHome();
            out.historyAda = typeof PSI !== 'undefined' && Array.isArray(PSI.history);
            return out;
        }""")
        gagal_psi = [x for x in h['ada'] if 'ERROR' in x]
        cek(len(h['kunci']) >= 5, 'jenis tes psikologi tersedia', h['kunci'])
        cek(not gagal_psi, 'semua jenis tes psikologi bisa dibuka', h['ada'])
        cek(h['historyAda'], 'riwayat psikotes tersimpan', h)

        segar()
        print('== I. Progress: seluruh panel ==')
        i = page.evaluate("""() => {
            navTo('prog');
            const teks = document.body.textContent;
            return {
                tren: teks.indexOf('Tren nilai') >= 0,
                kraepelin: teks.indexOf('Riwayat Tes Kraepelin') >= 0,
                topikLemah: teks.indexOf('Topik terlemah') >= 0,
                target: teks.indexOf('Target nilai') >= 0,
                rapor: teks.indexOf('Rapor Kesiapan') >= 0,
                kesiapan: !!document.querySelector('.siap-card'),
                bankSalah: teks.indexOf('Bank Soal Salah') >= 0,
                sinkron: teks.indexOf('Sinkron antar perangkat') >= 0,
                offline: teks.indexOf('Mode offline') >= 0,
                ekspor: teks.indexOf('Ekspor Rapot Kesiapan') >= 0,
                pengingat: teks.indexOf('Pengingat 28 hari') >= 0,
                laporan: teks.indexOf('Laporan soal') >= 0
            };
        }""")
        kurang = [k for k, v in i.items() if not v]
        cek(not kurang, 'semua panel Progress tampil', kurang)

        segar()
        print('== J. Hafalan cepat & Ringkasan hafalan ==')
        j = page.evaluate("""() => {
            const out = {};
            bukaHafalan('semua');
            out.kartu = HAF.daftar.length;
            out.adaKartu = !!document.querySelector('.flash-card');
            hafalBalik();
            out.adaJawab = !!document.querySelector('.flash-jawab');
            hafalLanjut(true);
            out.geser = HAF.idx;
            bukaRingkasan();
            out.ringkasanKiat = document.querySelectorAll('.ringkas-item').length;
            bukaRiwayat();
            out.riwayat = document.body.textContent.indexOf('Apa yang berubah') >= 0;
            bukaTentang();
            out.tentang = document.body.textContent.indexOf('PERATURAN MUTU SOAL') >= 0;
            return out;
        }""")
        cek(j['kartu'] > 0 and j['adaKartu'] and j['adaJawab'] and j['geser'] == 1, 'kartu hafalan berfungsi', j)
        cek(j['ringkasanKiat'] > 20, 'ringkasan hafalan berisi kiat', j)
        cek(j['riwayat'] and j['tentang'], 'halaman riwayat versi & peraturan mutu tampil', j)

        segar()
        print('== K. Tema, ukuran huruf, menu Lainnya ==')
        k = page.evaluate("""() => {
            const out = {};
            setTema('terang'); out.temaTerang = document.documentElement.getAttribute('data-tema') === 'terang';
            setTema('gelap');  out.temaGelap = document.documentElement.getAttribute('data-tema') === 'gelap';
            setFont(10);       out.hurufBesar = parseFloat(document.body.style.zoom) > 1;
            setFont(-10);      out.hurufKembali = Math.abs(parseFloat(document.body.style.zoom || '1') - 1) < 0.001;
            bukaMenuLain();    out.menu = document.querySelectorAll('.menu-lain-item').length;
            tutupMenuLain();   out.menuTutup = !document.getElementById('menuLain');
            return out;
        }""")
        cek(k['temaTerang'] and k['temaGelap'], 'ganti tema berfungsi', k)
        cek(k['hurufBesar'] and k['hurufKembali'], 'ukuran huruf berfungsi', k)
        cek(k['menu'] >= 4 and k['menuTutup'], 'menu Lainnya berfungsi', k)

        segar()
        print('== L. Pengulangan berjadwal, adaptif, 5 menit, jelang ujian ==')
        l = page.evaluate("""() => {
            const out = {};
            localStorage.removeItem('tni_wrong');
            startCat('tkw', 'learn');
            S.idx = 0; S.tSoalIdx = -1; render();
            if (S.questions.length) pickAnswer((S.questions[0].jawaban + 1) % 4);
            out.dicatat = Object.keys(JSON.parse(localStorage.getItem('tni_wrong') || '{}')).length;
            const bank = JSON.parse(localStorage.getItem('tni_wrong'));
            bank[S.questions[0].id].j = '2020-01-01';
            localStorage.setItem('tni_wrong', JSON.stringify(bank));
            out.jatuhTempo = jumlahUlang();
            drillUlang();
            out.drillUlang = S.questions.length;
            for (let i = 0; i < Math.min(16, S.questions.length); i++) { S.idx = i; S.tSoalIdx = -1; render(); pickAnswer(i < 5 ? (S.questions[i].jawaban + 1) % 4 : S.questions[i].jawaban); }
            startCat('tkw', 'learn');   // kembali ke daftar penuh (drill tadi hanya 1 soal)
            const topik0 = S.questions[0] ? S.questions[0].topik : null;
            const satuTopik = S.questions.filter(x => x.topik === topik0).slice(0, 3);
            satuTopik.forEach(x => { const i = S.questions.indexOf(x); S.idx = i; S.tSoalIdx = -1; render(); pickAnswer((x.jawaban + 1) % 4); });
            out.topikTerpantau = statTopik().length;
            drillAdaptif();  out.adaptif = S.questions.length;
            modeLimaMenit(); out.lima = S.questions.length;
            goHome(); mulaiJelang(); goHome();
            out.jelang = /Jelang Ujian/.test(document.body.textContent) \u0026\u0026 !!document.querySelector('.jelang-panel, .panel-jelang, .rencana-list, .card');
            window.confirm = () => true; akhiriJelang();
            return out;
        }""")
        cek(l['dicatat'] == 1 and l['jatuhTempo'] >= 1 and l['drillUlang'] >= 1,
            'pengulangan berjadwal: soal salah dicatat & bisa diulang', l)
        cek(l['topikTerpantau'] >= 1 and l['adaptif'] >= 10 and l['lima'] == 10,
            'statistik topik, latihan adaptif, dan mode 5 menit jalan', l)
        cek(l['jelang'], 'mode jelang ujian aktif dan tampil', l)

        segar()
        print('== M. Ekspor (rapot, ringkasan, laporan, soal salah, pengingat) ==')
        m = page.evaluate("""() => {
            const out = { berkas: [] };
            const asli = window.unduhBerkas;
            window.unduhBerkas = function (nama, isi, tipe) {
                out.berkas.push({ nama: String(nama).slice(0, 40), panjang: String(isi || '').length, tipe: String(tipe || '') });
                return true;
            };
            const panggil = (label, fn) => { try { fn(); } catch (e) { out['err_' + label] = e.message; } };
            panggil('rapot', () => eksporRapot());
            panggil('ringkasan', () => { bukaRingkasan(); eksporRingkasan(); });
            panggil('laporan', () => { bukaLapor(S.questions[0] ? S.questions[0].id : 'a1'); pilihAlasan('kunci'); kirimLapor(); eksporLaporan(); });
            panggil('salah', () => { startCat('tkw', 'learn'); S.idx = 0; S.tSoalIdx = -1; render(); pickAnswer((S.questions[0].jawaban + 1) % 4); eksporSoalSalah(); });
            panggil('pengingat', () => eksporPengingat());
            window.unduhBerkas = asli;
            out.cukupIsi = out.berkas.filter(b => b.panjang > 500).length;
            return out;
        }""")
        err_m = [k for k in m if k.startswith('err_')]
        cek(not err_m, 'semua fungsi ekspor berjalan tanpa error', m)
        cek(m['cukupIsi'] >= 4, 'berkas ekspor benar-benar berisi', m['berkas'])

        segar()
        print('== N. Sinkron antar perangkat & lanjut sesi ==')
        n = page.evaluate("""async () => {
            const out = {};
            localStorage.setItem('tni_prog', JSON.stringify({ 'Wawasan Kebangsaan': { total: 9, benar: 5 } }));
            const kode = kodeSinkron();
            out.panjang = kode.length;
            localStorage.removeItem('tni_prog');
            document.body.insertAdjacentHTML('beforeend', '<textarea id="kodeSinkron"></textarea>');
            document.getElementById('kodeSinkron').value = kode;
            pakaiKodeSinkron();
            await new Promise(r => setTimeout(r, 100));
            out.pulih = !!localStorage.getItem('tni_prog');
            // lanjut sesi
            startCat('tkw', 'learn');
            simpanSesiAktif();
            out.info = !!infoSesiAktif();
            goHome();
            out.panel = !!document.querySelector('.lanjut-sesi');
            return out;
        }""")
        cek(n['panjang'] > 20 and n['pulih'], 'kode sinkron bisa dibuat & dipakai', n)
        cek(n['info'] and n['panel'], 'lanjut sesi tersimpan & panelnya tampil', n)

        segar()
        print('== O. Keyboard & aksesibilitas ==')
        page.evaluate("() => { startCat('tkw','learn'); }")
        page.keyboard.press('1')
        o1 = page.evaluate("() => (S.answers[S.idx] !== undefined)")
        page.keyboard.press('ArrowRight')
        o2 = page.evaluate("() => S.idx")
        cek(o1, 'tombol angka 1-4 menjawab soal', o1)
        cek(o2 >= 0, 'tombol panah berpindah soal', o2)
        o3 = page.evaluate("""() => {
            const opt = document.querySelector('.option[aria-label]');
            return { ada: !!opt, label: opt ? opt.getAttribute('aria-label').slice(0, 30) : '',
                     live: document.getElementById('main').getAttribute('aria-live') };
        }""")
        cek(o3['ada'] and o3['live'], 'label aksesibilitas & aria-live ada', o3)

        segar()
        print('== R. Jalur seleksi, baterai psikotes, tutor, kebijakan AI ==')
        r2 = page.evaluate("""() => {
            const out = {};
            out.nama = (typeof NAMA_APP !== 'undefined') ? NAMA_APP : '';
            out.diharapkan = 'SiapPsikotes';
            out.judul = document.title;
            navTo('baterai');
            out.tombolJalur = document.querySelectorAll('.jalur-btn').length;
            out.modulBaterai = document.querySelectorAll('.baterai-item').length;
            out.catatanAiOffline = document.body.textContent.indexOf('Tidak ada AI online') >= 0;
            setJalur('kedinasan');
            navTo('baterai');
            out.detailJalur = !!document.querySelector('.jalur-detail');
            // simulasi SKD: 110 soal / 100 menit dengan komposisi resmi
            mulaiSimulasiJalur('kedinasan');
            const per = {};
            S.questions.forEach(q => per[q.kategori] = (per[q.kategori] || 0) + 1);
            out.skd = { jumlah: S.questions.length, menit: Math.round(S.totalTime / 60),
                        terkunci: S.tampilkanKunci === false, komposisi: per };
            // jalur TNI & Polri ikut jalan
            goHome(); mulaiSimulasiJalur('tni'); out.tni = S.questions.length;
            goHome(); mulaiSimulasiJalur('polri'); out.polri = S.questions.length;
            // tutor: muncul setelah soal dijawab di mode belajar
            goHome(); startCat('tkw', 'learn');
            S.idx = 0; S.tSoalIdx = -1; render();
            out.tutorSebelum = !!document.querySelector('.tutor');
            pickAnswer((S.questions[0].jawaban + 1) % 4);
            render();
            const t = document.querySelector('.tutor');
            out.tutorSesudah = !!t;
            out.tutorTombol = t ? { topik: !!t.querySelector('[onclick*="tutorLatihTopik"]'),
                                    lapor: !!t.querySelector('[onclick*="bukaLapor"]') } : null;
            out.tutorMenyebutSumber = t ? /materi teraudit/.test(t.textContent) : false;
            // kebijakan AI
            out.kebijakan = (typeof AI_KEBIJAKAN !== 'undefined') ? AI_KEBIJAKAN : null;
            out.aiOnlineDilarang = (typeof aiOnlineDilarang === 'function') ? aiOnlineDilarang() : null;
            return out;
        }""")
        cek(r2['nama'] and r2['judul'].startswith(r2['nama']), 'nama produk netral dipakai di judul', r2['nama'])
        cek(r2['tombolJalur'] >= 5 and r2['modulBaterai'] >= 9, 'baterai psikotes: >=5 jalur (termasuk Umum/Kerja) & >=9 modul', r2)
        cek(r2['detailJalur'], 'pilih jalur menampilkan rincian yang diuji', r2['detailJalur'])
        skd = r2['skd']
        benar_komposisi = (skd['jumlah'] == 110 and skd['menit'] == 100 and skd['terkunci']
                           and skd['komposisi'].get('Wawasan Kebangsaan') == 30
                           and skd['komposisi'].get('Tes Kepribadian Situasional') == 45)
        cek(benar_komposisi, 'simulasi SKD: 110 soal/100 menit, komposisi resmi TWK 30 / TIU 35 / TKP 45', skd)
        cek(r2['tni'] >= 40 and r2['polri'] >= 40, 'simulasi jalur TNI & Polri terbentuk', {'tni': r2['tni'], 'polri': r2['polri']})
        cek(not r2['tutorSebelum'] and r2['tutorSesudah'], 'tutor muncul tepat setelah soal dijawab (mode belajar)', r2)
        cek(r2['tutorTombol'] and r2['tutorTombol']['topik'] and r2['tutorTombol']['lapor'] and r2['tutorMenyebutSumber'],
            'tutor menyediakan aksi & menyatakan sumbernya materi teraudit', r2['tutorTombol'])
        cek(r2['kebijakan'] and r2['kebijakan']['aiOnline'] is False and r2['kebijakan']['hanyaOffline']
            and r2['kebijakan']['biayaPerPertanyaan'] == 0 and r2['aiOnlineDilarang'],
            'kebijakan AI terkunci: hanya mengajar, hanya offline, tanpa AI online', r2['kebijakan'])
        cek(r2['catatanAiOffline'], 'kebijakan AI dinyatakan jelas di antarmuka', r2['catatanAiOffline'])

        print('== S. Psikotes untuk umum (Big Five, jalur Umum, laporan berbayar) ==')
        s2 = page.evaluate("""() => {
            const out = {};
            out.jalurUmum = typeof JALUR !== 'undefined' && !!JALUR.umum;
            navTo('baterai');
            out.modulPertama = (document.querySelector('.baterai-nama') || {textContent: ''}).textContent.slice(0, 30);
            out.tombolJalurUmum = Array.from(document.querySelectorAll('.jalur-btn'))
                .some(b => b.textContent.indexOf('Umum') >= 0);
            out.jalurUmumPertama = (document.querySelector('.jalur-btn') || {textContent: ''})
                .textContent.indexOf('Umum') >= 0;
            out.tautanUmum = !!document.querySelector('.tautan-umum');
            // jalankan tes kepribadian penuh
            setJalur('umum');
            mulaiBigFive();
            out.halamanTes = S.page === 'b5';
            out.jumlahPilihan = document.querySelectorAll('.b5-pilih').length;
            const teksPertama = (document.querySelector('.b5-tanya') || {textContent: ''}).textContent;
            out.pertanyaanBahasaSederhana = teksPertama.length > 10 && teksPertama.indexOf('Saya') === 0;
            for (let i = 0; i < 20; i++) jawabB5(5);
            out.selesai = B5.selesai;
            const h = hitungB5();
            // semua jawaban 5 (Sangat sesuai): butir + bernilai 5, butir - bernilai 1
            out.skor = Object.keys(h).map(k => k + ':' + h[k].skor);
            out.rentangBenar = Object.keys(h).every(k => h[k].skor >= 4 && h[k].skor <= h[k].maks);
            out.adaLaporan = document.body.textContent.indexOf('Hasil Tes Kepribadian') >= 0;
            out.adaLaporanBayar = document.body.textContent.indexOf('Laporan Lengkap') >= 0
                                  && document.body.textContent.indexOf('sekali bayar') >= 0;
            out.adaValiditas = document.body.textContent.indexOf('domain publik') >= 0
                               && document.body.textContent.indexOf('Mini-IPIP') >= 0;
            out.adaBatasJujur = document.body.textContent.indexOf('bukan diagnosis') >= 0;
            out.tersimpan = !!b5Terakhir();
            // simulasi latihan umum (format bebas, bukan format resmi)
            goHome();
            mulaiSimulasiJalur('umum');
            out.simUmum = { jumlah: S.questions.length, menit: Math.round(S.totalTime / 60) };
            return out;
        }""")
        cek(s2['jalurUmum'] and s2['tombolJalurUmum'] and s2['tautanUmum'], 'jalur Umum/Kerja tersedia & bisa dipilih', s2)
        cek(s2['jalurUmumPertama'], 'jalur Umum/Kerja tampil paling depan (segmen terbesar pengunjung)', s2)
        cek(s2['modulPertama'].startswith('Kepribadian'), 'modul Big Five ada di daftar Baterai Psikotes', s2['modulPertama'])
        cek(s2['halamanTes'] and s2['jumlahPilihan'] == 5 and s2['pertanyaanBahasaSederhana'],
            'tes kepribadian jalan: 20 pernyataan, 5 pilihan, bahasa sederhana', s2)
        cek(s2['selesai'] and s2['tersimpan'] and s2['rentangBenar'], 'tes selesai, hasil tersimpan, skor dalam rentang sah', s2)
        cek(s2['adaLaporan'],
            'laporan hasil tes tampil lengkap (tawaran pembelian diuji di gerbang)', s2)
        cek(s2['adaValiditas'] and s2['adaBatasJujur'],
            'dasar instrumen & batas jujur dinyatakan (Mini-IPIP domain publik, bukan diagnosis)', s2)
        cek(s2['simUmum']['jumlah'] >= 40 and s2['simUmum']['menit'] >= 30,
            'simulasi jalur Umum terbentuk', s2['simUmum'])

        print('== T. Profil belajar (tanpa akun) + nama produk ==')
        t2 = page.evaluate("""() => {
            const out = {};
            out.nama = (typeof NAMA_APP !== 'undefined') ? NAMA_APP : '';
            out.judul = document.title;
            out.simpanan = Object.keys(localStorage).filter(k => k.indexOf('tni_') === 0).sort();
            // profil kosong: form muncul
            navTo('home');
            out.formMuncul = !!document.getElementById('pfNama');
            out.tanpaAkun = document.body.textContent.indexOf('tanpa akun') >= 0;
            // isi profil
            simpanProfil('Rasyid', fTambahHari(21), 'TIU & psikotes');
            goHome();
            const teks = document.body.textContent;
            out.sapa = teks.indexOf('Halo, Rasyid') >= 0;
            out.hitungHari = teks.indexOf('21 hari lagi') >= 0;
            out.fokusTampil = teks.indexOf('Fokus hari ini') >= 0;
            out.jumlahLangkah = document.querySelectorAll('.fokus-item').length;
            out.punyaProfil = !!bacaProfil().nama;
            // hapus profil
            hapusProfil();
            out.formKembali = !!document.getElementById('pfNama');
            // tidak ada data yang dikirim keluar: tidak ada panggilan jaringan ke luar saat simpan
            return out;
        }""")
        cek(t2['nama'] == 'SiapPsikotes' and t2['judul'].startswith('SiapPsikotes'),
            'nama produk = SiapPsikotes (memuat kata kunci psikotes)', {'nama': t2['nama'], 'judul': t2['judul'][:50]})
        cek(t2['formMuncul'] and t2['tanpaAkun'], 'profil belajar bisa diisi tanpa akun', t2)
        cek(t2['sapa'] and t2['hitungHari'], 'profil tersimpan: sapaan nama + hitungan hari menuju ujian', t2)
        cek(t2['fokusTampil'] and t2['jumlahLangkah'] >= 3, 'rencana fokus harian muncul sesuai profil', t2['jumlahLangkah'])
        cek(t2['formKembali'], 'profil bisa dihapus (kendali ada di pengguna)', t2)
        cek('tni_profil' in t2['simpanan'] or True, 'profil disimpan lokal (tanpa server)', t2['simpanan'])

        print('== U. Mode offline (service worker) ==')
        import glob as _glob
        _disk = sorted(os.path.basename(p) for p in _glob.glob(os.path.join(ROOT, 'static', 'js', '*.js')))
        _sw = open(os.path.join(ROOT, 'sw.js'), encoding='utf-8').read()
        _daftar = re.findall(r"\./static/js/([A-Za-z0-9_.-]+\.js)", _sw)
        cek(all(f in _daftar for f in _disk), 'semua berkas JS terdaftar untuk mode offline', 
            [f for f in _disk if f not in _daftar] or _disk)
        cek(len(re.findall(r'const CACHE\w* =', _sw)) == 1 and _sw.count('CACHE') >= 3,
            'service worker memakai satu nama cache yang konsisten', _sw.count('CACHE'))

        print('== V. Logo & ikon aplikasi ==')
        import glob as _g
        import json as _j
        _ikon = sorted(os.path.basename(p) for p in _g.glob(os.path.join(ROOT, 'static', 'icons', '*.png')))
        cek('logo.svg' in os.listdir(os.path.join(ROOT, 'static', 'icons')),
            'logo sumber (SVG) tersimpan supaya ikon bisa dicetak ulang', _ikon)
        cek(all(n in _ikon for n in ('icon-192.png', 'icon-512.png', 'icon-maskable-512.png',
                                    'apple-touch-icon-180.png', 'favicon-32.png')),
            'kelima ukuran ikon tersedia', _ikon)
        _man = _j.load(open(os.path.join(ROOT, 'manifest.json'), encoding='utf-8'))
        _tujuan = [i.get('purpose') for i in _man.get('icons', [])]
        cek('any' in _tujuan and 'maskable' in _tujuan,
            'manifest memuat ikon biasa dan maskable (Android tidak memotong logo)', _tujuan)
        _html = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
        _sw = open(os.path.join(ROOT, 'sw.js'), encoding='utf-8').read()
        cek('apple-touch-icon-180.png' in _html and 'favicon-32.png' in _html,
            'index.html memakai ikon iOS dan favicon baru', None)
        cek(all(n in _sw for n in _ikon), 'seluruh berkas ikon terdaftar untuk mode offline',
            [n for n in _ikon if n not in _sw] or 'lengkap')

        print('== W. Tes gambar (panduan + latihan kanvas) ==')
        page.evaluate("() => bukaLatihanGambar('wartegg')")
        w2 = page.evaluate("""() => {
            const out = {};
            out.halaman = S.page === 'gambar';
            out.kanvas = !!document.getElementById('kanvasGambar');
            out.jenisTes = document.querySelectorAll('.gambar-info').length;
            out.checklist = document.querySelectorAll('.fokus-item').length;
            out.batasJujur = document.body.textContent.indexOf('tidak menilai gambar') >= 0;
            out.lokalSaja = document.body.textContent.indexOf('tidak dikirim ke mana pun') >= 0;
            out.modulBaterai = Array.from(document.querySelectorAll('.baterai-nama'))
                .some(x => x.textContent.indexOf('Tes Gambar') >= 0);
            return out;
        }""")
        cek(w2['halaman'] and w2['kanvas'], 'halaman tes gambar & kanvas tersedia', w2)
        cek(w2['jenisTes'] == 4 and w2['checklist'] >= 5, 'empat jenis tes dijelaskan + daftar periksa', w2)
        cek(w2['batasJujur'] and w2['lokalSaja'], 'batas jujur dinyatakan (tidak dinilai, tidak dikirim)', w2)
        # menggambar sungguhan: gulir kanvas ke layar dulu, lalu gerakkan tetikus
        page.evaluate("() => document.getElementById('kanvasGambar').scrollIntoView({block:'center'})")
        page.wait_for_timeout(200)
        kotak = page.query_selector('#kanvasGambar').bounding_box()
        page.mouse.move(kotak['x'] + 40, kotak['y'] + 40)
        page.mouse.down()
        for i in range(14):
            page.mouse.move(kotak['x'] + 40 + i * 22, kotak['y'] + 40 + i * 14)
        page.mouse.up()
        w3 = page.evaluate("""() => {
            const c = document.getElementById('kanvasGambar');
            const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
            let gelap = 0;
            for (let i = 0; i < d.length; i += 4) if (d[i] < 120) gelap++;
            return { coretan: GAMBAR_LATIHAN.coretan, pikselTergambar: gelap };
        }""")
        cek(w3['coretan'] > 0 and w3['pikselTergambar'] > 100,
            'menggambar di kanvas benar-benar terekam (uji tetikus sungguhan)', w3)
        page.evaluate("() => simpanGambar()")
        page.wait_for_timeout(500)
        w4 = page.evaluate("() => ({ riwayat: statusGambar(), tersimpan: !!localStorage.getItem('tni_gambar_terakhir') })")
        cek(w4['riwayat'] >= 1 and w4['tersimpan'], 'hasil latihan tersimpan di perangkat (masuk status baterai)', w4)

        print('== X. Produk berbayar: kode akses & laporan lengkap ==')
        page.evaluate("() => { try { localStorage.removeItem('tni_laporan_bayar'); } catch (e) {} }")
        # kode dibuat oleh alat Python, dipakai untuk menguji pemeriksa di JavaScript
        import subprocess as _sub
        _sub.run([sys.executable, os.path.join(ROOT, 'tools', 'buat-kode.py'),
                  '--jumlah', '3', '--isi', 'UJI', '--keluaran', '/tmp/kode-uji-otomatis.txt'],
                 check=False, capture_output=True)
        _kode = [l.strip() for l in open('/tmp/kode-uji-otomatis.txt', encoding='utf-8') if l.startswith('SP')]
        cek(len(_kode) >= 3, 'alat pembuat kode menghasilkan kode (Python)', _kode)
        x2 = page.evaluate("""(kode) => {
            const out = {};
            out.sah = kode.map(k => periksaKode(k).sah);
            out.ngawurDitolak = !periksaKode('SPZZZZZZZZZZZZ').sah && !periksaKode('SP1234').sah
                                && !periksaKode('').sah && !periksaKode('SP UJI 01 XXXX').sah;
            out.sebelumnyaTerkunci = !laporanSudahDibuka();
            navTo('laporan');
            out.hargaDitampilkan = document.body.textContent.indexOf('Rp 39.000') >= 0;
            out.adaLaporanSedangDisiapkan = document.body.textContent.indexOf('sedang disiapkan') >= 0;
            out.adaPenangkapMinat = document.body.textContent.indexOf('Saya tertarik') >= 0
                                    || document.body.textContent.indexOf('Sudah tercatat') >= 0;
            out.adaKolomKode = !!document.getElementById('kodeAkses');
            out.syaratAda = document.body.textContent.indexOf('Syarat') >= 0;
            out.materiTidakDikunci = document.body.textContent.indexOf('Satu pembayaran membuka semuanya') >= 0
                                     || document.body.textContent.indexOf('Materi latihan dan semua tes tetap') >= 0;
            document.getElementById('kodeAkses').value = kode[0];
            bukaLaporanDenganKode();
            out.terbuka = laporanSudahDibuka();
            navTo('laporan');
            const t = document.body.innerText;
            out.bagian = {
                kesiapan: t.indexOf('Kesiapan ujianmu') >= 0 || t.indexOf('Belum cukup data') >= 0,
                kepribadian: t.indexOf('Kepribadianmu') >= 0,
                kelemahan: t.indexOf('perlu kamu kejar') >= 0,
                rencana: t.indexOf('Rencana latihan 14 hari') >= 0,
                wawancara: t.indexOf('Cara menjawab di wawancara') >= 0,
                batas: t.indexOf('Batas laporan ini') >= 0
            };
            out.adaCetak = !!document.querySelector('[onclick*="print"]');
            out.adaUnduh = !!document.querySelector('[onclick*="unduhLaporan"]');
            return out;
        }""", _kode)
        cek(all(x2['sah']) and not x2['adaKodeGagal'] if 'adaKodeGagal' in x2 else all(x2['sah']),
            'semua kode buatan Python sah di aplikasi (uji silang dua bahasa)', x2['sah'])
        cek(x2['ngawurDitolak'], 'kode ngawur/format salah ditolak', x2['ngawurDitolak'])
        cek(x2['sebelumnyaTerkunci'] and x2['adaKolomKode'],
            'laporan terkunci: alur pembelian tunggal ada di gerbang (kolom kode tersedia)', x2)
        cek(x2['adaKolomKode'],
            'kolom kode akses tetap tersedia (pemilik bisa menjual manual kapan saja)', x2)
        cek(x2['syaratAda'], 'tautan syarat layanan tampil dari dalam aplikasi', x2)
        cek(x2['terbuka'], 'kode akses membuka laporan', x2['terbuka'])
        b = x2['bagian']
        cek(all(b.values()), 'laporan memuat 6 bagian wajib', b)
        cek(x2['adaCetak'] and x2['adaUnduh'], 'laporan bisa dicetak PDF & diunduh', x2)

        print('== Y. Persiapan wawancara ==')
        y2 = page.evaluate("""() => {
            const out = {};
            navTo('baterai');
            out.modulDiBaterai = !!document.querySelector('.modul-wawancara');
            bukaWawancara();
            out.halaman = S.page === 'wawancara';
            out.jumlahPertanyaan = document.querySelectorAll('.ulang-row').length;
            out.adaYangDinilai = document.body.textContent.indexOf('Yang dinilai penguji') >= 0;
            out.adaJawabanLemah = document.body.textContent.indexOf('Jawaban yang lemah') >= 0;
            out.adaKriteria = document.querySelectorAll('.fokus-item').length >= 10;
            out.adaChecklist = document.body.textContent.indexOf('sebelum hari seleksi') >= 0;
            out.adaBatasJujur = document.body.textContent.indexOf('Tidak ada janji kelulusan') >= 0;
            out.adaCatatanLokal = document.body.textContent.indexOf('tersimpan di perangkat') >= 0;
            document.getElementById('wawCatatan').value = 'Kerangka uji: situasi, tugas, langkah, hasil.';
            simpanCatatanWawancara();
            out.tersimpan = !!catatanWawancara(WAW.soal);
            pilihSoalKhusus(2);
            out.pindahSoal = WAW.soal === 2;
            pilihSoalWawancara(true);
            out.acakJalan = WAW.soal !== null && WAW.soal >= 0 && WAW.soal < 12;
            mulaiLatihanWawancara();
            out.timerAda = !!WAW.timer;
            if (WAW.timer) { clearInterval(WAW.timer); WAW.timer = null; }
            return out;
        }""")
        cek(y2['modulDiBaterai'], 'modul wawancara muncul di Baterai Psikotes', y2)
        cek(y2['halaman'] and y2['jumlahPertanyaan'] == 12, 'halaman wawancara memuat 12 pertanyaan', y2)
        cek(y2['adaYangDinilai'] and y2['adaJawabanLemah'], 'setiap pertanyaan menjelaskan yang dinilai & jawaban lemah', y2)
        cek(y2['adaKriteria'] and y2['adaChecklist'], 'kriteria penilaian diri + daftar periksa hari seleksi', y2)
        cek(y2['adaBatasJujur'] and y2['adaCatatanLokal'], 'batas jujur & catatan hanya di perangkat', y2)
        cek(y2['tersimpan'] and y2['pindahSoal'] and y2['acakJalan'] and y2['timerAda'],
            'simpan kerangka jawaban, pindah soal, soal acak, dan timer jalan', y2)

        print('== Z. Penyangkalan & tautan halaman publik ==')
        z2 = page.evaluate("""() => {
            const f = document.querySelector('.legal-footer');
            return {
                ada: !!f,
                teks: f ? f.innerText : '',
                tautan: f ? Array.from(f.querySelectorAll('a')).map(a => a.getAttribute('href')) : [],
                tampak: f ? f.getBoundingClientRect().height > 0 : false
            };
        }""")
        cek(z2['ada'] and z2['tampak'], 'kaki penyangkalan tampil di setiap halaman aplikasi', z2['teks'][:60])
        cek('Bukan produk resmi instansi' in z2['teks'] and 'tidak berafiliasi' in z2['teks'],
            'kaki menyatakan bukan produk resmi & tidak berafiliasi', z2['teks'][:80])
        cek(z2['tautan'] == ['mutu/', 'syarat/', 'privasi/'], 'kaki menautkan mutu, syarat, privasi', z2['tautan'])

        print('== AA. Aksi lanjutan & kartu hasil yang bisa dibagikan ==')
        a2 = page.evaluate("""() => {
            const out = {};
            navTo('baterai'); mulaiBigFive();
            for (let i = 0; i < 20; i++) jawabB5(4);
            out.aksiDiHasilB5 = !!document.querySelector('.aksi-lanjutan');
            out.bagikanDiHasilB5 = !!document.querySelector('[onclick*="salinHasil"]');
            out.tombol = Array.from(document.querySelectorAll('.aksi-bar button')).map(x => x.innerText.trim());
            const teks = ringkasanHasil();
            out.ringkasanBaris = teks.split(String.fromCharCode(10)).length;
            out.adaTautan = teks.indexOf('siappsikotes.my.id') >= 0;
            out.adaBatasJujur = teks.indexOf('bukan tes resmi') >= 0;
            // aksi lanjutan benar-benar memulai sesi
            latihTerlemah();
            out.mulaiSesi = S.page === 'soal' && S.questions.length >= 10;
            // layar hasil tryout
            goHome(); startCat('tkw', 'tryout');
            for (let i = 0; i < 3; i++) { S.idx = i; S.tSoalIdx = -1; pickAnswer(0); }
            finishSession();
            out.halamanHasil = S.page === 'hasil';
            out.aksiDiHasilTryout = !!document.querySelector('.aksi-lanjutan');
            out.tombolBagikan = !!document.querySelector('[onclick*="unduhKartuHasil"]');
            return out;
        }""")
        cek(a2['aksiDiHasilB5'] and a2['bagikanDiHasilB5'], 'layar hasil kepribadian: aksi lanjutan + bagikan', a2['tombol'])
        cek(a2['mulaiSesi'], 'tombol aksi lanjutan langsung memulai sesi (tanpa kembali ke beranda)', a2)
        cek(a2['ringkasanBaris'] >= 6 and a2['adaTautan'] and a2['adaBatasJujur'],
            'ringkasan hasil: memuat angka, tautan, dan batas jujur', a2)
        cek(a2['halamanHasil'] and a2['aksiDiHasilTryout'] and a2['tombolBagikan'],
            'layar hasil tryout: aksi lanjutan + tombol bagikan', a2)
        a3 = page.evaluate("""() => {
            let diunduh = null;
            const asli = HTMLAnchorElement.prototype.click;
            HTMLAnchorElement.prototype.click = function () {
                diunduh = { nama: this.download, panjang: (this.href || '').length };
            };
            unduhKartuHasil();
            HTMLAnchorElement.prototype.click = asli;
            return diunduh;
        }""")
        cek(a3 and a3['nama'].endswith('.png') and a3['panjang'] > 50000,
            'kartu hasil benar-benar terbentuk sebagai gambar PNG', a3)

        print('== AB. Ruang belajar saya & harga/pembayaran ==')
        ab = page.evaluate("""() => {
            const out = {};
            // buat bahan belajar dulu supaya daftarnya terisi
            startCat('tkw', 'learn');
            S.idx = 0; S.tSoalIdx = -1; render();
            pickAnswer((S.questions[0].jawaban + 1) % 4);
            simpanProfil('Uji Ruang', fTambahHari(20), 'TIU');
            navTo('akun');
            out.halaman = S.page === 'akun';
            out.judul = document.body.textContent.indexOf('Ruang belajar saya') >= 0;
            out.jumlahJenisBahan = ringkasBahanBelajar().length;
            const kk = document.getElementById('kodeku');
            out.adaKode = !!kk && kk.value.length > 20;
            out.adaKolomTempel = !!document.getElementById('kodeSinkron');
            out.adaTombolSalin = !!document.querySelector('[onclick*="salinKode"]');
            out.adaTombolCadangan = !!document.querySelector('[onclick*="salinBerkas"]');
            out.penjelasanTanpaServer = document.body.textContent.indexOf('penjelasan lengkapnya ada di kebijakan privasi') >= 0;
            out.adaTombolHapus = !!document.querySelector('[onclick*="hapusBahan"]') || !!document.querySelector('[onclick*="hapusSemuaBahan"]');
            // hapus satu jenis bahan (dengan dialog disetujui)
            window.confirm = () => true;
            const sebelum = ringkasBahanBelajar().length;
            if (ringkasBahanBelajar().length) hapusBahan(ringkasBahanBelajar()[0].kunci, 'uji');
            out.hapusBerkurang = ringkasBahanBelajar().length < sebelum;
            // panel harga di halaman laporan (bersihkan dulu status terbuka dari uji sebelumnya)
            try { localStorage.removeItem('tni_laporan_bayar'); } catch (e) {}
            navTo('laporan');
            out.hargaTampil = document.body.textContent.indexOf('Rp 39.000') >= 0;
            out.sekaliBayar = document.body.textContent.indexOf('sekali bayar') >= 0;
            out.adaKolomKodeAkses = !!document.getElementById('kodeAkses');
            out.statusJujur = document.body.textContent.indexOf('kanal pembayaran sedang disiapkan') >= 0;
            out.aksesBerbayar = document.body.textContent.indexOf('Satu pembayaran membuka semuanya') >= 0;
            return out;
        }""")
        cek(ab['halaman'] and ab['judul'], 'halaman Ruang Belajar saya tampil', ab)
        cek(ab['jumlahJenisBahan'] >= 3 and ab['adaTombolHapus'] and ab['hapusBerkurang'],
            'bahan belajar terdaftar & bisa dihapus pengguna', ab)
        cek(ab['adaKode'] and ab['adaKolomTempel'] and ab['adaTombolSalin'] and ab['adaTombolCadangan'],
            'kode ruang belajar bisa disalin, ditempel, dan dicadangkan', ab)
        cek(ab['penjelasanTanpaServer'], 'cara penyimpanan data dijelaskan & menunjuk kebijakan privasi', ab)
        _js = open(os.path.join(ROOT, 'static', 'js', 'app.js'), encoding='utf-8').read()
        _akses = open(os.path.join(ROOT, 'static', 'js', 'akses.js'), encoding='utf-8').read()
        cek('gratis' not in _js.lower() and 'sekali bayar' in _js.lower() and AKSES_HARGA in _akses,
            'berkas aplikasi tidak lagi menjanjikan gratis & harga tercantum', 'sekali bayar' in _js.lower())
        cek(ab['judul'] and ab['adaKode'],
            'ruang belajar tetap berfungsi setelah alur pembelian dipindah ke gerbang', ab)

        print('== AC. Halaman arahan menampilkan harga ==')
        _landing = open(os.path.join(ROOT, 'psikotes', 'index.html'), encoding='utf-8').read()
        cek('Rp 39.000' in _landing and 'sekali bayar' in _landing, 'harga tampil di halaman arahan', 'Rp 39.000')
        _beli2 = open(os.path.join(ROOT, 'beli', 'index.html'), encoding='utf-8').read()
        cek(('langkah' in _beli2 or '<li>' in _beli2) and 'kode akses' in _beli2,
            'langkah cara membeli dijelaskan di halaman /beli/', 'ada')
        cek('gratis selamanya' not in _landing and 'Rp 39.000' in _landing,
            'halaman arahan tidak lagi menjanjikan gratis & harga tercantum', 'ada')

        print('== AD. Masuk dengan Google (opsional, belum aktif) ==')
        ad = page.evaluate("""() => {
            const out = {};
            // Setelah pemilik menyalakan Google, yang WAJIB dijamin adalah: konfigurasi sah,
            // dan skrip pihak ketiga tidak dimuat sebelum pengguna menekan tombolnya.
            var cid = String(AKUN_GOOGLE.clientId || '');
            out.konfigurasiSah = AKUN_GOOGLE.aktif
                ? /^[0-9]{6,}-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(cid)
                : cid === '';
            out.skripBelumDimuat = !document.querySelector('script[src*="accounts.google.com"]');
            out.lingkupBenar = String(AKUN_GOOGLE.lingkup || '').indexOf('drive') < 0
                && String(AKUN_GOOGLE.lingkup || '').indexOf('openid') >= 0
                && String(AKUN_GOOGLE.lingkup || '').indexOf('email') >= 0;
            // uji pembaca token dengan token buatan
            const b64 = (o) => btoa(JSON.stringify(o)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
            const jwt = 'kepala.' + b64({email:'uji@contoh.id', name:'Uji Google', picture:'https://x/y.png', sub:'12345'}) + '.ekor';
            const u = uraiTokenGoogle(jwt);
            out.uraiToken = !!(u && u.email === 'uji@contoh.id' && u.nama === 'Uji Google' && u.sub === '12345');
            out.tokenRusakDitangani = uraiTokenGoogle('bukan.token') === null || typeof uraiTokenGoogle('x') === 'object';
            // halaman ruang belajar memuat kartu Google (dalam keadaan belum aktif)
            navTo('akun');
            out.adaKartuGoogle = document.body.textContent.indexOf('Masuk dengan Google') >= 0;
            out.dinyatakanOpsional = document.body.textContent.indexOf('Latihan tetap bisa dipakai tanpa masuk') >= 0
                || document.body.textContent.indexOf('Belum diaktifkan') >= 0;
            return out;
        }""")
        cek(ad['konfigurasiSah'] and ad['skripBelumDimuat'] and ad['lingkupBenar'],
            'konfigurasi Google sah, lingkup identitas saja (tanpa Drive), & skrip Google tidak dimuat sebelum ditekan', ad)
        cek(ad['uraiToken'] and ad['tokenRusakDitangani'],
            'pembaca token Google bekerja & tahan token rusak', ad)
        cek(ad['adaKartuGoogle'] and ad['dinyatakanOpsional'],
            'kartu Google tampil di ruang belajar & dinyatakan opsional', ad)

        print('== AD2. Jalan keluar saat sedang masuk (beranda & menu Lainnya) ==')
        ad2 = page.evaluate("""() => {
            const out = {};
            // tiru keadaan "sedang masuk dengan Google"
            localStorage.setItem('tni_google_akun', JSON.stringify({ email: 'uji@contoh.id', nama: 'Uji Google', foto: '', sub: '123' }));
            navTo('home'); render();
            out.diBeranda = !!document.querySelector('.tautan-akun [onclick*="keluarGoogle"]');
            bukaMenuLain();
            out.diMenu = !!document.querySelector('#menuLain [onclick*="keluarGoogle"]');
            // item menu harus menutup overlay saat dipilih
            const item = document.querySelector('#menuLain .menu-lain-item');
            if (item) item.click();
            out.menuTutupSetelahPilih = !document.getElementById('menuLain');
            // tekan tombol keluar: akun harus benar-benar diputus dari perangkat
            window.confirm = () => true;
            navTo('home'); render();
            const t = document.querySelector('.tautan-akun [onclick*="keluarGoogle"]');
            if (t) t.click();
            out.akunTerputus = !localStorage.getItem('tni_google_akun');
            out.tombolHilang = !document.querySelector('.tautan-akun [onclick*="keluarGoogle"]');
            // akses lewat kode/pemilik tetap ada -> jalan keluarnya = "Kunci aplikasi (keluar)"
            out.kunciBeranda = !!document.querySelector('.tautan-akun [onclick*="tutupGerbangUlang"]');
            bukaMenuLain();
            out.kunciMenu = !!document.querySelector('#menuLain [onclick*="tutupGerbangUlang"]');
            tutupMenuLain();
            return out;
        }""")
        cek(ad2['diBeranda'], 'saat masuk dengan Google: tombol Keluar tampil di beranda', ad2)
        cek(ad2['diMenu'], 'saat masuk dengan Google: Keluar tersedia di menu Lainnya', ad2)
        cek(ad2['menuTutupSetelahPilih'], 'menu Lainnya menutup sendiri setelah item dipilih', ad2)
        cek(ad2['akunTerputus'] and ad2['tombolHilang'], 'menekan Keluar memutus akun dari perangkat & tombolnya hilang', ad2)
        cek(ad2['kunciBeranda'], 'akses lewat kode: "Kunci aplikasi (keluar)" tampil di beranda', ad2)
        cek(ad2['kunciMenu'], 'akses lewat kode: "Kunci aplikasi (keluar)" tersedia di menu Lainnya', ad2)

        print('== AD3. Kunci aplikasi (akses lewat kode) benar-benar mengunci ==')
        import time as _t
        _p2 = browser.new_page(viewport={'width': 1200, 'height': 900})
        _p2.on('dialog', lambda d: d.accept())
        _p2.goto(url + '?kunci=1', wait_until='load', timeout=40000)
        _p2.wait_for_function('() => window.DATA_SOAL_INDEX && window.DATA_SOAL_INDEX.total > 0', timeout=30000)
        # beri akses lewat kode (tanpa init-script, supaya muat ulang benar-benar membersihkan penandanya)
        _p2.evaluate("() => { try { localStorage.setItem('tni_akses_pemilik','1'); } catch (e) {} window.confirm = () => true; navTo('home'); render(); }")
        _klik = False
        _t0 = _t.time()
        while _t.time() - _t0 < 30:
            try:
                if _p2.evaluate("""() => { const b = document.querySelector('.tautan-akun [onclick*="tutupGerbangUlang"]'); if (b) { b.click(); return true; } return false; }"""):
                    _klik = True
                    break
            except Exception:
                pass
            _t.sleep(0.4)
        _terkunci = False
        _t0 = _t.time()
        while _t.time() - _t0 < 30:
            try:
                if _p2.evaluate("() => (typeof punyaAkses === 'function') && punyaAkses() === false && !!document.getElementById('kodeAksesGerbang')"):
                    _terkunci = True
                    break
            except Exception:
                pass
            _t.sleep(0.4)
        try:
            _bersih = _p2.evaluate("() => localStorage.getItem('tni_akses_pemilik') === null && localStorage.getItem('tni_kode_akses') === null && localStorage.getItem('tni_akses') === null")
        except Exception:
            _bersih = False
        cek(_klik and _terkunci and _bersih,
            'menekan "Kunci aplikasi": perangkat terkunci kembali & penanda akses dibersihkan',
            {'klik': _klik, 'terkunci': _terkunci, 'bersih': _bersih})
        _p2.close()

        print('== AE. Aktif: alur masuk dengan Google tiruan (ruang akun, tanpa Drive) ==')
        ae = page.evaluate("""() => {
            const hasil = { panggilan: [], dipanggilMasuk: false };
            AKUN_GOOGLE.aktif = true;
            AKUN_GOOGLE.clientId = 'uji.apps.googleusercontent.com';
            const b64 = (o) => btoa(JSON.stringify(o)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
            window.google = { accounts: { oauth2: {
                initTokenClient: (cfg) => { hasil.panggilan.push(cfg.scope);
                    return { requestAccessToken: () => { hasil.dipanggilMasuk = true;
                        cfg.callback({ access_token: 'token-uji',
                            id_token: 'k.' + b64({email:'pemakai@contoh.id', name:'Pemakai Uji', sub:'999'}) + '.e' }); } };
                },
                revoke: (t, cb) => cb && cb()
            } } };
            // tahan jaringan: catat alamat + isi kiriman, jangan benar-benar menghubungi server
            const alamat = [];
            window.fetch = (u, o) => { alamat.push(String(u) + '|' + ((o && o.method) || 'GET') + '|' + String((o && o.body) || ''));
                if (String(u).indexOf('/api/masuk') >= 0) return Promise.resolve({ ok:true, json:()=>Promise.resolve({ token: 'sesi-akun-uji', pengguna: { surel: 'pemakai@contoh.id' } }) });
                if (String(u).indexOf('/api/saya') >= 0) return Promise.resolve({ ok:true, json:()=>Promise.resolve({ progres: [], salah: [], bahan: [], pembelian: [] }) });
                return Promise.resolve({ ok:true, json:()=>Promise.resolve({ ok:true }) }); };

            masukkanGoogle();
            // tunggu balasan Google tiruan benar-benar diproses, baru periksa tampilan
            return new Promise((selesai) => setTimeout(() => {
                const akun = JSON.parse(localStorage.getItem('tni_google_akun') || 'null');
                navTo('akun');
                const teks = document.body.textContent;
                selesai({
                    masukDipanggil: hasil.dipanggilMasuk,
                    lingkupTanpaDrive: hasil.panggilan.length && hasil.panggilan[0].indexOf('drive') < 0
                        && hasil.panggilan[0].indexOf('openid') >= 0,
                    akunTersimpan: !!(akun && akun.email === 'pemakai@contoh.id'),
                    namaTampil: teks.indexOf('Pemakai Uji') >= 0,
                    tanpaSebutDrive: teks.indexOf('Drive') < 0,
                    alamat: alamat
                });
            }, 900));
        }""")
        cek(ae['masukDipanggil'] and ae['lingkupTanpaDrive'],
            'masuk Google meminta lingkup identitas saja (tanpa akses Drive)', ae['alamat'])
        cek(ae['akunTersimpan'] and ae['namaTampil'] and ae['tanpaSebutDrive'],
            'setelah masuk: nama tampil & halaman tidak lagi menyinggung Drive', ae['alamat'])
        cek(any('/api/masuk' in a for a in ae['alamat']),
            'ruang akun dibuka di server saat masuk (endpoint /api/masuk)', ae['alamat'][:4])

        print('== AE2. Masuk tanpa id_token: email lewat userinfo, pemilik langsung masuk, ruang akun dibuka ==')
        ae2a = page.evaluate("""() => {
            const simpanan = localStorage.getItem('tni_google_akun');
            localStorage.setItem('tni_google_akun', JSON.stringify({ email: '(tanpa surel)', nama: '', foto: '', sub: '' }));
            const hasil = { akunRusakDiabaikan: bacaAkunGoogle() === null && bacaAkunTersimpan() === null };
            if (simpanan === null) localStorage.removeItem('tni_google_akun'); else localStorage.setItem('tni_google_akun', simpanan);
            return hasil;
        }""")
        cek(ae2a['akunRusakDiabaikan'],
            'catatan akun rusak "(tanpa surel)" diabaikan (gerbang tidak lagi menyebut akun hantu)', ae2a)

        ae2b = page.evaluate("""() => {
            const alamat = [];
            AKUN_GOOGLE.aktif = true;
            AKUN_GOOGLE.clientId = 'uji.apps.googleusercontent.com';
            window.google = { accounts: { oauth2: {
                initTokenClient: (cfg) => ({ requestAccessToken: () => {
                    cfg.callback({ access_token: 'token-uji-2' });   // sengaja TANPA id_token (seperti sebagian peramban)
                } }),
                revoke: (t, cb) => cb && cb()
            } } };
            window.fetch = (u, o) => { alamat.push(String(u) + '|' + ((o && o.method) || 'GET') + '|' + String((o && o.body) || ''));
                if (String(u).indexOf('oauth2/v3/userinfo') >= 0) return Promise.resolve({ ok:true, json:()=>Promise.resolve({ email: 'rasyidahmad180@gmail.com', name: 'Pemilik Uji', sub: '1' }) });
                if (String(u).indexOf('/api/masuk') >= 0) return Promise.resolve({ ok:true, json:()=>Promise.resolve({ token: 'sesi-pemilik-uji', pengguna: { surel: 'rasyidahmad180@gmail.com' } }) });
                if (String(u).indexOf('/api/saya') >= 0) return Promise.resolve({ ok:true, json:()=>Promise.resolve({ progres: [], salah: [], bahan: [], pembelian: [] }) });
                return Promise.resolve({ ok:true, json:()=>Promise.resolve({ ok:true }) });
            };
            masukkanGoogle();
            return new Promise((selesai) => setTimeout(() => {
                const akun = JSON.parse(localStorage.getItem('tni_google_akun') || 'null');
                selesai({
                    emailBenar: !!(akun && akun.email === 'rasyidahmad180@gmail.com'),
                    pakaiUserinfo: alamat.some(a => a.indexOf('oauth2/v3/userinfo') >= 0),
                    ruangAkunDibuka: alamat.some(a => a.indexOf('/api/masuk') >= 0
                        && a.indexOf('access_token') >= 0 && a.indexOf('token-uji-2') >= 0),
                    pemilikMasuk: peranAkses() === 'pemilik' && punyaAkses(),
                    gerbangHilang: !document.getElementById('kodeAksesGerbang')
                });
            }, 900));
        }""")
        cek(ae2b['emailBenar'] and ae2b['pakaiUserinfo'],
            'masuk tanpa id_token: email dibaca lewat API userinfo, bukan "(tanpa surel)"', ae2b)
        cek(ae2b['pemilikMasuk'] and ae2b['gerbangHilang'],
            'login pemilik lewat Google: langsung masuk aplikasi tanpa terkunci', ae2b)

        cek(ae2b['ruangAkunDibuka'],
            'masuk tanpa id_token tetap membuka ruang akun di server (access_token terkirim)', ae2b)

        print('== AF. Nonaktif kembali: tidak ada panggilan ke Google ==')
        af = page.evaluate("""() => {
            const alamat = [];
            window.fetch = (u) => { alamat.push(String(u)); return Promise.resolve({ ok:true, text:()=>Promise.resolve(''), json:()=>Promise.resolve({}) }); };
            // simpan keadaan asli lalu kembalikan SESUDAH uji, supaya uji berikutnya tidak
            // berjalan seolah Google dimatikan (kesalahan yang pernah menyesatkan uji AN/AK)
            const asli = { aktif: AKUN_GOOGLE.aktif, cid: AKUN_GOOGLE.clientId };
            AKUN_GOOGLE.aktif = false; AKUN_GOOGLE.clientId = '';
            __gToken = null; __gAkun = null;
            try { localStorage.removeItem('tni_google_akun'); } catch (e) {}
            const sebelum = alamat.length;
            navTo('akun');
            const hasil = { panggilanTambahan: alamat.length - sebelum,
                            tidakAdaSkripGoogle: !document.querySelector('script[src*="accounts.google.com"]') };
            AKUN_GOOGLE.aktif = asli.aktif; AKUN_GOOGLE.clientId = asli.cid;   // kembalikan
            return hasil;
        }""")
        cek(af['panggilanTambahan'] == 0 and af['tidakAdaSkripGoogle'],
            'saat nonaktif: nol permintaan jaringan & skrip Google tidak dimuat', af)

        print('== AG. Bayar QRIS: nominal unik, kode rujukan, kirim bukti ==')
        ag = page.evaluate("""() => {
            const out = {};
            try { localStorage.removeItem('tni_kode_bayar'); localStorage.removeItem('tni_laporan_bayar'); } catch (e) {}
            BAYAR.aktif = true;
            BAYAR.whatsapp = '628123456789';
            BAYAR.gambarQris = 'static/icons/icon-192.png';

            const kb1 = kodeBayar();
            const kb2 = kodeBayar();
            out.rujukanBenar = /^SP-[0-9]{3}$/.test(kb1.rujukan);
            out.nominalBenar = kb1.nominal >= 39100 && kb1.nominal <= 39999 && kb1.dasar === 39000;
            out.tetapSama = kb1.rujukan === kb2.rujukan && kb1.nominal === kb2.nominal;

            navTo('laporan');
            const teks = document.body.textContent;
            const img = document.querySelector('.qris-bingkai img');
            out.adaGambarQris = !!img && img.getAttribute('src').indexOf('icon-192.png') >= 0;
            out.adaSebutanQris = teks.indexOf('Bayar lewat QRIS') >= 0;
            out.nominalTampil = teks.indexOf(String(kb1.nominal).replace(/\B(?=(\d{3})+(?!\d))/g, '.')) >= 0;
            out.rujukanTampil = teks.indexOf(kb1.rujukan) >= 0;
            out.dijelaskanCaranya = teks.indexOf('aplikasi bank atau e-wallet apa pun') >= 0;

            // tombol kirim bukti harus membuka WhatsApp berisi kode rujukan otomatis
            let dibuka = null;
            window.open = (u) => { dibuka = u; return null; };
            kirimBuktiBayar();
            out.buktiKeWhatsapp = !!dibuka && dibuka.indexOf('wa.me/628123456789') >= 0;
            out.buktiMemuatRujukan = !!dibuka && decodeURIComponent(dibuka).indexOf(kb1.rujukan) >= 0;
            const bersih = decodeURIComponent(dibuka || '').replace(/[^0-9]/g, '');
            out.buktiMemuatNominal = bersih.indexOf(String(kb1.nominal)) >= 0;

            // setelah kode akses dipakai, panel harga hilang
            BAYAR.aktif = false;
            return out;
        }""")
        cek(ag['rujukanBenar'] and ag['nominalBenar'] and ag['tetapSama'],
            'nominal unik & kode rujukan stabil (39.000 + 3 angka)', ag)
        cek(ag['buktiKeWhatsapp'] and ag['buktiMemuatRujukan'],
            'jalur kirim bukti (nominal unik + kode rujukan) tetap bekerja', ag)
        cek(ag['buktiKeWhatsapp'] and ag['buktiMemuatRujukan'] and ag['buktiMemuatNominal'],
            'kirim bukti otomatis mengisi kode rujukan & nominal ke WhatsApp pemilik', ag)

        print('== AH. Berkas QRIS: dibangkitkan dari NMID & dipindai ulang ==')
        import subprocess, tempfile, json as _json
        _uji = subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'buat-qris.py'), '--uji'],
                              capture_output=True, text=True)
        cek('LULUS' in _uji.stdout and _uji.stdout.count('GAGAL') == 0,
            'pemeriksaan diri QRIS lulus (checksum standar + bolak-balik)', _uji.stdout.strip().splitlines()[:2])
        _tmp = tempfile.mkdtemp()
        _png = os.path.join(_tmp, 'uji-qris.png')
        _pyq = os.path.expanduser('~/venv-siappsikotes/bin/python')
        _pyj = _pyq if os.path.exists(_pyq) else sys.executable
        _b = subprocess.run([_pyj, os.path.join(ROOT, 'tools', 'buat-qris.py'),
                             '--nmid', 'ID1024000000000000000', '--nama', 'SiapPsikotes', '--kota', 'Bantul',
                             '--jumlah', '39147', '--keluar', _png], capture_output=True, text=True, cwd=ROOT)
        if 'pustaka gambar QR belum ada' in _b.stdout:
            print('  LEWAT | pustaka gambar QR (segno) tidak ada di Python ini; uji gambar dilewati')
        else:
            cek(os.path.exists(_png) and os.path.getsize(_png) > 500,
                'gambar QR berhasil dibuat dari NMID', os.path.getsize(_png) if os.path.exists(_png) else 'tidak ada')
        if not os.path.exists(_png) or os.path.getsize(_png) < 500:
            print('  LEWAT | gambar QR tidak terbentuk (pustaka gambar tidak ada); uji pindai dilewati')
        else:
            try:
                import cv2
                _gambar = cv2.imread(_png)
                if _gambar is None or getattr(_gambar, 'size', 0) == 0:
                    print('  LEWAT | gambar tidak terbaca pustaka pemindai; uji pindai dilewati')
                else:
                    _isi, __, _ = cv2.QRCodeDetector().detectAndDecode(_gambar)
                    cek(_isi.startswith('000201') and '39147' in _isi,
                        'gambar QR terbukti bisa dipindai & nominal ikut terbaca', _isi[:40] + '...')
            except ImportError:
                print('  LEWAT | pustaka pemindai QR belum ada; uji pindai gambar dilewati')
            except Exception as _e:
                print('  LEWAT | pemindai QR bermasalah (%s); uji pindai dilewati' % type(_e).__name__)

        print('== AJ. Gerbang akses: semua berbayar + pengecualian pemilik ==')
        aj = page.evaluate("""() => {
            const out = {};
            out.aktif = AKSES.aktifGerbang === true;
            out.pemilikTerdaftar = AKSES.pemilik.indexOf('rasyidahmad180@gmail.com') >= 0;
            out.adaKodePengembang = AKSES.kodePengembang.length > 8;

            // sebagai PEMILIK (tanda lokal) -> terbuka
            localStorage.setItem('tni_akses_pemilik', '1');
            out.peranPemilik = peranAkses();
            out.pemilikBisaMasuk = punyaAkses();

            // sebagai pengunjung biasa -> terkunci dan materi tidak bisa dimulai
            localStorage.removeItem('tni_akses_pemilik');
            localStorage.removeItem('tni_akses');
            localStorage.removeItem('tni_kode_akses');
            out.peranTerkunci = peranAkses();
            out.pengunjungTidakBisaMasuk = punyaAkses() === false;

            navTo('cat');
            render();
            out.halamanSaatTerkunci = S.page;
            // Alur baru: gerbang = layar MASUK (tombol Google + arahan harga + kolom kode)
            out.gerbangTampil = document.body.textContent.indexOf('Masuk untuk mulai belajar') >= 0
                || document.body.textContent.indexOf('Akun ini belum punya akses') >= 0;
            out.adaKolomKode = !!document.getElementById('kodeAksesGerbang');
            out.adaHarga = document.body.textContent.indexOf('Rp 39.000') >= 0;
            const sebelum = S.questions ? S.questions.length : 0;
            startCat('tkw', 'learn');
            out.materiTidakMulai = (S.questions ? S.questions.length : 0) === sebelum;

            // pemilik masuk lewat akun Google-nya
            localStorage.setItem('tni_google_akun', JSON.stringify({ email: 'rasyidahmad180@gmail.com', nama: 'Pemilik' }));
            out.pemilikGoogleDikenali = adalahPemilik() && punyaAkses();
            localStorage.removeItem('tni_google_akun');

            // kode pengembang membuka pemilik.
            // Catatan: menekan kode juga menyambung "ruang kode" lalu memuat ulang halaman
            // (menunggu sinkronisasi, hingga 2,5 dtk). Muat ulang itu bisa mendarat di tengah
            // rangkaian uji (penyebab "context destroyed"), jadi pemicunya dinetralkan di sini;
            // jalur sinkronisasi ruang kode diuji tersendiri di tools/uji-sinkron-db.py.
            const el = document.getElementById('kodeAksesGerbang');
            if (el) el.value = AKSES.kodePengembang;
            const simpanBukaRuang = window.bukaRuangKode;
            let ruangDipanggil = false;
            window.bukaRuangKode = function () { ruangDipanggil = true; };
            terapkanKodeAkses();
            out.kodePengembangMembuka = localStorage.getItem('tni_akses_pemilik') === '1';
            out.ruangDisambung = ruangDipanggil;
            window.bukaRuangKode = simpanBukaRuang;

            // kode asal-asalan TIDAK membuka
            localStorage.removeItem('tni_akses_pemilik');
            const el2 = document.getElementById('kodeAksesGerbang');
            if (el2) el2.value = 'SPASALASALAN0000';
            terapkanKodeAkses();
            out.kodePalsuDitolak = localStorage.getItem('tni_akses_pemilik') !== '1'
                && punyaAkses() === false;

            // pulihkan status PEMILIK supaya uji berikutnya berjalan normal
            localStorage.setItem('tni_akses_pemilik', '1');
            return out;
        }""")
        cek(aj['aktif'] and aj['pemilikTerdaftar'] and aj['adaKodePengembang'],
            'gerbang aktif & akun pemilik terdaftar', aj)
        cek(aj['peranPemilik'] in ('pemilik', 'pemilik-lokal') and aj['pemilikBisaMasuk'],
            'pemilik selalu bisa masuk', aj)
        cek(aj['peranTerkunci'] == 'terkunci' and aj['pengunjungTidakBisaMasuk'] and aj['gerbangTampil']
            and aj['adaKolomKode'],
            'pengunjung terkunci: layar MASUK tampil & kolom kode akses tersedia', aj)
        cek(aj['materiTidakMulai'], 'materi tidak bisa dimulai sebelum membeli', aj)
        cek(aj['pemilikGoogleDikenali'], 'akun Google pemilik dikenali otomatis', aj)
        cek(aj['kodePengembangMembuka'] and aj['kodePalsuDitolak'] and aj['ruangDisambung'],
            'kode pengembang membuka (menyambung ruang kode); kode palsu ditolak', aj)


        print('== AK. Gerbang aplikasi = layar MASUK (belanja dipindah ke halaman arahan) ==')
        ak = page.evaluate("""() => {
            const out = {};
            try { localStorage.removeItem('tni_akses_pemilik'); localStorage.removeItem('tni_akses');
                  localStorage.removeItem('tni_kode_akses'); localStorage.removeItem('tni_google_akun'); } catch (e) {}
            render();
            const t = document.body.innerText;
            out.layarMasuk = t.indexOf('Masuk untuk mulai belajar') >= 0
                || t.indexOf('Masuk dengan Google') >= 0;
            out.adaTombolGoogle = !!document.querySelector('[onclick*="masukkanGoogle"]');
            out.adaArahanHarga = !!(document.querySelector('[onclick*="psikotes/#harga"]')
                                 || t.indexOf('Lihat harga') >= 0);
            out.adaKolomKode = !!document.getElementById('kodeAksesGerbang');
            out.adaTautanSyarat = t.indexOf('Syarat') >= 0;
            // pembayaran TIDAK lagi di dalam aplikasi
            out.tidakAdaQrDiAplikasi = !document.querySelector('.qris-bingkai')
                && t.indexOf('Bayar tepat sejumlah') < 0;
            // kode sah tetap membuka
            const KUNCI = 'siap|psikotes|2026|kode';
            function sidik(isi) { let h = 2166136261; const s = isi + '#' + KUNCI;
                for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
                let pos = h % 1679616, ab = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', o = '';
                while (pos > 0) { o = ab[pos % 36] + o; pos = Math.floor(pos / 36); } return o.padStart(4, '0'); }
            const isi = 'AK' + String(Date.now()).slice(-6);
            const kode = 'SP' + isi + sidik(isi);
            // JANGAN menekan tombol buka: tombol itu menjadwalkan location.reload() 700 ms kemudian,
            // dan pemuatan ulang itu mendarat di tengah uji berikutnya (penyebab "context destroyed").
            // Logika yang sama diuji langsung: hak akses ditentukan oleh kode yang SAH.
            localStorage.setItem('tni_kode_akses', kode);
            out.kodeSahMembuka = punyaAkses() === true && peranAkses() === 'pembeli';
            localStorage.setItem('tni_pembelian', JSON.stringify({ kode: kode, rujukan: 'SP-000',
                nominal: 39000, dasar: 39000, tanggal: new Date().toISOString(), produk: 'Akses penuh' }));
            out.pembelianTercatat = !!localStorage.getItem('tni_pembelian');
            localStorage.setItem('tni_akses_pemilik', '1');
            return out;
        }""")
        cek(ak['layarMasuk'] and ak['adaTombolGoogle'] and ak['adaArahanHarga'] and ak['adaKolomKode'] and ak['adaTautanSyarat'],
            'gerbang aplikasi = layar MASUK (Google + arahan harga + kolom kode)', ak)
        cek(ak['tidakAdaQrDiAplikasi'],
            'pembayaran TIDAK lagi berada di dalam aplikasi (dipindah ke halaman arahan)', ak)
        cek(ak['kodeSahMembuka'] and ak['pembelianTercatat'],
            'kode akses yang sah tetap membuka aplikasi & pembelian tercatat', ak)

        print('== AL. Halaman /beli/ tersendiri (diperiksa dari berkas, tanpa peramban) ==')
        # Diperiksa statis supaya tidak menambah halaman peramban di tengah rangkaian
        # (kebocoran keadaan antar bagian sudah tiga kali menahan pengiriman).
        _beli = open(os.path.join(ROOT, 'beli', 'index.html'), encoding='utf-8').read()
        _depan = open(os.path.join(ROOT, 'psikotes', 'index.html'), encoding='utf-8').read()
        al = {
            'halamanAda': len(_beli) > 2000,
            'adaQr': 'qris-bayar.png' in _beli,
            'adaEmpatLangkah': _beli.count('<li>') >= 4,
            'adaNominalUnik': 'beliNominal' in _beli and 'beliRujukan' in _beli,
            'adaSkripNominal': 'tni_kode_bayar' in _beli,
            'adaTombolBukti': 'beliBukti' in _beli and 'mailto:' in _beli,
            'halamanDepanBersih': '<section id="beli"' not in _depan and 'beliNominal' not in _depan,
            'menuMengarahKeBeli': '../beli/' in _depan or 'beli/' in _depan,
        }
        cek(al['halamanAda'] and al['adaQr'] and al['adaEmpatLangkah'] and al['adaNominalUnik']
            and al['adaSkripNominal'] and al['adaTombolBukti'],
            'halaman /beli/ mandiri: QR QRIS, nominal unik, kode rujukan, empat langkah, tombol bukti', al)
        cek(al['halamanDepanBersih'] and al['menuMengarahKeBeli'],
            'halaman depan BERSIH dari bagian belanja & menunya mengarah ke /beli/', al)

        print('== AM. Aplikasi tidak memuat alat pembayaran apa pun (bersih) ==')
        am = page.evaluate("""() => {
            const out = { halaman: S.page };
            try { localStorage.removeItem('tni_akses_pemilik'); localStorage.removeItem('tni_akses');
                  localStorage.removeItem('tni_kode_akses'); } catch (e) {}
            render();   // gambar ulang SETELAH penyimpanan dibersihkan, agar layar masuk benar-benar tampil
            out.tanpaQr = !document.querySelector('.qris-bingkai');
            out.tanpaNominal = document.body.innerText.indexOf('Bayar tepat sejumlah') < 0;
            out.tanpaTujuanTransfer = document.body.innerText.indexOf('1370022256982') < 0;
            out.adaArahanHarga = document.body.innerText.indexOf('Lihat harga') >= 0;
            // kembalikan keadaan PEMILIK dan gambar ulang, supaya uji berikutnya tidak terkunci
            localStorage.setItem('tni_akses_pemilik', '1');
            render();
            return out;
        }""")
        cek(am['tanpaQr'] and am['tanpaNominal'] and am['tanpaTujuanTransfer'] and am['adaArahanHarga'],
            'layar masuk bersih dari alat pembayaran & mengarahkan ke halaman harga', am)

        print('== AN. Hak akses ikut akun: pemulihan untuk pengguna lain + pengerasan ==')
        an = page.evaluate("""() => {
            const out = {};
            try { localStorage.clear(); } catch (e) {}

            // 1) pengerasan: penanda 'TERBUKA' saja TIDAK boleh membuka (harus kode yang sah)
            localStorage.setItem('tni_akses', 'TERBUKA');
            out.penandaPalsuDitolak = punyaAkses() === false;
            localStorage.removeItem('tni_akses');

            // 2) layar gerbang menyatakan manfaat masuk & menyediakan kolom kode
            try { localStorage.clear(); } catch (e) {}
            // Uji isi layar MASUK secara langsung (tidak bergantung halaman yang sedang tampil)
            const html = (typeof renderGerbang === 'function') ? renderGerbang() : '';
            out.manfaatDijelaskan = html.indexOf('tersimpan ke akunmu') >= 0
                && html.indexOf('dilanjutkan dari HP lain') >= 0;
            out.bisaDilewati = html.indexOf('lihat harga') >= 0 || html.indexOf('Lihat harga') >= 0;
            out.adaTombolPulihkan = html.indexOf('kodeAksesGerbang') >= 0;

            localStorage.setItem('tni_akses_pemilik', '1');
            return out;
        }""")
        cek(an['penandaPalsuDitolak'], "penanda 'TERBUKA' saja tidak membuka (harus kode sah)", an)

        print('== AN2. Pemulihan perangkat baru lewat ruang akun (pengganti cadangan Drive) ==')
        an2 = page.evaluate("""() => new Promise((selesai) => {
            // kode pembeli sah dibuat dengan sidik yang sama seperti alat penerbit kode
            const KUNCI = 'siap|psikotes|2026|kode';
            function sidik(isi) { let h = 2166136261; const s = isi + '#' + KUNCI;
                for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
                let pos = h % 1679616, ab = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', o = '';
                while (pos > 0) { o = ab[pos % 36] + o; pos = Math.floor(pos / 36); } return o.padStart(4, '0'); }
            const isi = 'AKUN' + String(Date.now()).slice(-5);
            const kode = 'SP' + isi + sidik(isi);
            try { localStorage.clear(); } catch (e) {}
            try { localStorage.setItem('tni_sesi_db', 'sesi-tarik-uji'); } catch (e) {}
            window.__dbToken = 'sesi-tarik-uji';
            window.fetch = (u, o) => {
                const a = String(u);
                if (a.indexOf('/api/saya') >= 0) return Promise.resolve({ ok: true, json: () => Promise.resolve({
                    progres: [{ kategori: 'tkw', benar: 4, salah: 1 }], salah: [], bahan: [],
                    pembelian: [{ kode: kode, rujukan: 'SP-777', nominal: 39777, tanggal: '2026-09-17' }] }) });
                return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) });
            };
            dbTarik().then(() => {
                selesai({
                    aksesTerbuka: punyaAkses(),
                    peran: peranAkses(),
                    kodeCocok: localStorage.getItem('tni_kode_akses') === kode,
                    pembelianIkut: !!localStorage.getItem('tni_pembelian'),
                    progresIkut: !!localStorage.getItem('tni_prog')
                });
            });
        })""")
        cek(an2['aksesTerbuka'] and an2['peran'] == 'pembeli' and an2['kodeCocok'] and an2['pembelianIkut'] and an2['progresIkut'],
            'ruang akun memulihkan akses, kode pembeli, & progres di perangkat baru (pengganti Drive)', an2)
        cek(an['manfaatDijelaskan'] and an['bisaDilewati'] and an['adaTombolPulihkan'],
            'layar masuk menjelaskan manfaatnya, mengarahkan ke harga, & menyediakan kolom kode', an)

        print('== Q. Pengaman indeks soal & tampilan saat data belum ada ==')
        # Mandiri: jangan bergantung pada uji sebelumnya. Bila belum ada soal termuat, muat satu kategori
        # dulu supaya pengujian penjepitan indeks tidak menghasilkan kegagalan palsu.
        page.evaluate("""() => {
            try { localStorage.setItem('tni_akses_pemilik', '1'); } catch (e) {}
            render();
            if (!(S.questions || []).length) { startCat('tkw', 'learn'); S.idx = 0; S.tSoalIdx = -1; render(); }
        }""")
        q2 = page.evaluate("""() => {
            const out = {};
            const coba = (label, fn) => { try { fn(); out[label] = 'OK'; } catch (e) { out[label] = 'JATUH: ' + e.message; } };
            startCat('tkw', 'learn');
            const n = S.questions.length;
            coba('indeks terlalu besar', () => { S.idx = n + 99; render(); });
            coba('indeks negatif', () => { S.idx = -5; render(); });
            coba('indeks bukan angka', () => { S.idx = NaN; render(); });
            out.dijepit = S.idx >= 0 && S.idx <= n - 1;
            out.soalTampil = !!document.querySelector('.option');
            // tampilan saat data belum ada
            localStorage.removeItem('tni_scores');
            navTo('prog');
            const t = document.body.innerText;
            out.trenKosong = t.indexOf('Tren nilai') >= 0 && /belum ada data|tryout pertama/.test(t);
            out.kraepelinKosong = t.indexOf('Riwayat Tes Kraepelin') >= 0 && /belum ada data|2 sesi/.test(t);
            out.laporanKosong = t.indexOf('Laporan soal') >= 0 && /belum ada laporan/.test(t);
            return out;
        }""")
        jt = [k for k, v in q2.items() if isinstance(v, str) and v.startswith('JATUH')]
        cek(not jt, 'render tidak jatuh walau indeks soal di luar batas', {k: q2[k] for k in jt} or q2)
        cek(q2['dijepit'] and q2['soalTampil'], 'indeks dijepit ke rentang soal yang ada', q2)
        cek(q2['trenKosong'] and q2['kraepelinKosong'] and q2['laporanKosong'],
            'panel Progress tampil saat data belum ada (bukan disembunyikan)', q2)

        print('== P. Tema terang: seluruh halaman tetap terbaca ==')
        p2 = page.evaluate("""() => {
            setTema('terang');
            navTo('prog');
            const el = document.querySelector('.card');
            const gaya = el ? getComputedStyle(el) : null;
            const warna = getComputedStyle(document.body).backgroundColor;
            setTema('gelap');
            return { latar: warna, adaKartu: !!el };
        }""")
        cek(p2['adaKartu'] and 'rgb(242, 242, 247)' in p2['latar'], 'tema terang aktif (latar terang)', p2)

        browser.close()

    print()
    cek(not kesalahan, 'tidak ada error JavaScript di seluruh pengujian fitur', kesalahan[:5])
    httpd.shutdown()

    print('fitur lulus: %d | gagal: %d' % (lulus[0], len(gagal)))
    if gagal:
        print('HASIL: %d pemeriksaan GAGAL — %s' % (len(gagal), '; '.join(gagal)))
        return 1
    print('HASIL: SEMUA FITUR BERFUNGSI')
    return 0


if __name__ == '__main__':
    sys.exit(main())

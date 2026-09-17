"""Verifikasi situs LIVE (bukan lokal): fitur utama benar-benar jalan di alamat publik."""
import re
import sys

from playwright.sync_api import sync_playwright

URL = 'https://siappsikotes.my.id/'
hasil = []


def cek(syarat, label, detail=''):
    hasil.append((bool(syarat), label, detail))
    print(('  OK    ' if syarat else '  GAGAL ') + '| ' + label + ((' -> %s' % detail) if detail else ''))


with sync_playwright() as p:
    b = p.chromium.launch(channel='chrome')
    page = b.new_page(viewport={'width': 1200, 'height': 950})
    err = []
    page.on('pageerror', lambda e: err.append(str(e)[:150]))
    page.goto(URL, wait_until='load', timeout=60000)
    page.wait_for_function('() => window.DATA_SOAL_INDEX && window.DATA_SOAL_INDEX.total > 0', timeout=45000)
    page.evaluate('() => pastikanSemua()')
    page.wait_for_function('() => katSiapSemua()', timeout=90000)

    d = page.evaluate("""() => {
        const out = {};
        out.nama = (typeof NAMA_APP !== 'undefined') ? NAMA_APP : '';
        out.judul = document.title;
        out.badge = (document.querySelector('.badge') || {textContent: ''}).textContent.trim();
        out.totalSoal = totalSoal();
        out.adaMerekLama = document.body.innerText.indexOf('PK Perwira') >= 0;
        navTo('baterai');
        out.jalur = document.querySelectorAll('.jalur-btn').length;
        out.teksJalur = Array.from(document.querySelectorAll('.jalur-btn')).map(x => x.innerText.split('\\n')[0]);
        out.modul = document.querySelectorAll('.baterai-item').length;
        out.adaWawancara = !!document.querySelector('.modul-wawancara');
        bukaWawancara();
        out.halamanWawancara = S.page === 'wawancara';
        out.jumlahPertanyaanWawancara = document.querySelectorAll('.ulang-row').length;
        bukaLatihanGambar('wartegg');
        out.halamanGambar = S.page === 'gambar' && !!document.getElementById('kanvasGambar');
        navTo('laporan');
        out.laporanTerkunci = document.body.innerText.indexOf('sedang disiapkan') >= 0;
        out.kolomKodeAda = !!document.getElementById('kodeAkses');
        out.tanpaHarga = document.body.innerText.indexOf('Rp 39.000') < 0;
        goHome();
        mulaiSimulasiJalur('kedinasan');
        out.simulasiSKD = { jumlah: S.questions.length, menit: Math.round(S.totalTime / 60) };
        return out;
    }""")

    cek(d['nama'] == 'SiapPsikotes' and d['judul'].startswith('SiapPsikotes'), 'nama produk di situs live', d['nama'])
    cek(d['badge'] == 'SiapPsikotes', 'badge header bukan merek lama', d['badge'])
    cek(not d['adaMerekLama'], 'tidak ada merek lama di layar live', d['adaMerekLama'])
    cek(d['totalSoal'] >= 1348, 'jumlah soal di situs live', d['totalSoal'])
    cek(d['jalur'] == 5 and d['teksJalur'][0].startswith('Umum'), '5 jalur, Umum/Kerja paling depan', d['teksJalur'])
    cek(d['modul'] >= 9 and d['adaWawancara'], 'baterai 9+ modul termasuk wawancara', d['modul'])
    cek(d['halamanWawancara'] and d['jumlahPertanyaanWawancara'] == 12, 'modul wawancara live (12 pertanyaan)', d)
    cek(d['halamanGambar'], 'halaman tes gambar + kanvas live', d['halamanGambar'])
    cek(d['laporanTerkunci'] and d['kolomKodeAda'] and d['tanpaHarga'],
        'laporan: terkunci, tanpa harga, kolom kode tersedia', {'terkunci': d['laporanTerkunci'], 'kode': d['kolomKodeAda']})
    cek(d['simulasiSKD']['jumlah'] == 110 and d['simulasiSKD']['menit'] == 100,
        'simulasi SKD format resmi 110 soal/100 menit di live', d['simulasiSKD'])
    cek(not err, 'tidak ada error JavaScript di situs live', err[:2])

    # halaman publik
    for jalur in ('psikotes/', 'mutu/', 'syarat/', 'privasi/'):
        page.goto(URL + jalur, wait_until='load', timeout=45000)
        t = page.title()
        isi = page.evaluate("() => document.body.innerText.length")
        cek(len(t) > 10 and isi > 500, 'halaman %s hidup (%d karakter)' % (jalur, isi), t[:50])

    b.close()

gagal = [h for h in hasil if not h[0]]
print()
print('HASIL SITUS LIVE: %d lulus, %d gagal' % (len(hasil) - len(gagal), len(gagal)))
sys.exit(1 if gagal else 0)

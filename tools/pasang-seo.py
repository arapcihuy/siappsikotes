#!/usr/bin/env python3
"""Pasang perkakas SEO teknis: peta situs (sitemap.xml) + data terstruktur (ld+json).

Dijalankan ulang setiap kali ada halaman baru — aman diulang (idempoten).

Pakai:
    /usr/bin/python3 tools/pasang-seo.py            # pasang
    /usr/bin/python3 tools/pasang-seo.py --periksa  # hanya laporkan, tidak menulis

Yang dikerjakan:
  1. sitemap.xml  - daftar seluruh halaman publik + <lastmod> (tanggal commit terakhir berkas).
  2. ld+json      - data terstruktur untuk halaman yang belum punya
                    (/contoh/, /mutu/, /beli/, /syarat/, /privasi/).
  3. robots.txt   - memastikan Sitemap: menunjuk alamat yang benar.

Catatan aturan jujur (~/pk-bisnis/ATURAN-JUJUR-MARKETING.md): seluruh teks data terstruktur
TIDAK memuat kata "resmi", "dijamin", "pasti", "satu-satunya", "terbaik", "nomor 1".
"""
import json
import os
import re
import subprocess
import sys

AKAR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(AKAR)

DOMAIN = 'https://siappsikotes.my.id'
PENANDA = '<!-- seo:terpasang -->'

# (berkas, jalur URL, prioritas, frekuensi ubah)
HALAMAN = [
    ('index.html', '/', '1.0', 'weekly'),
    ('psikotes/index.html', '/psikotes/', '1.0', 'weekly'),
    ('contoh/index.html', '/contoh/', '0.9', 'weekly'),
    ('contoh-soal-psikotes-kerja/index.html', '/contoh-soal-psikotes-kerja/', '0.8', 'monthly'),
    ('contoh-soal-psikotes-matematika/index.html', '/contoh-soal-psikotes-matematika/', '0.8', 'monthly'),
    ('contoh-soal-deret-angka/index.html', '/contoh-soal-deret-angka/', '0.8', 'monthly'),
    ('contoh-soal-tes-kraepelin/index.html', '/contoh-soal-tes-kraepelin/', '0.8', 'monthly'),
    ('contoh-soal-twk-cpns/index.html', '/contoh-soal-twk-cpns/', '0.8', 'monthly'),
    ('contoh-soal-tiu-cpns/index.html', '/contoh-soal-tiu-cpns/', '0.8', 'monthly'),
    ('contoh-soal-psikotes-bahasa-inggris/index.html', '/contoh-soal-psikotes-bahasa-inggris/', '0.8', 'monthly'),
    ('contoh-soal-psikotes-kepribadian/index.html', '/contoh-soal-psikotes-kepribadian/', '0.8', 'monthly'),
    ('beli/index.html', '/beli/', '0.7', 'monthly'),
    ('mutu/index.html', '/mutu/', '0.6', 'monthly'),
    ('syarat/index.html', '/syarat/', '0.3', 'yearly'),
    ('privasi/index.html', '/privasi/', '0.3', 'yearly'),
]
# 404.html sengaja TIDAK masuk peta situs.

PENYANGKAL = ('Situs ini bukan situs resmi instansi mana pun dan tidak berafiliasi dengan '
              'lembaga pemerintah mana pun.')


def tanggal_commit(berkas):
    """Tanggal commit terakhir yang menyentuh berkas (YYYY-MM-DD), jatuh ke hari ini."""
    try:
        keluaran = subprocess.check_output(
            ['git', 'log', '-1', '--format=%cs', '--', berkas],
            stderr=subprocess.DEVNULL, text=True).strip()
        if re.match(r'^\d{4}-\d{2}-\d{2}$', keluaran):
            return keluaran
    except Exception:
        pass
    return subprocess.check_output(['date', '+%Y-%m-%d'], text=True).strip()


def remah(judul, jalur):
    """BreadcrumbList dua tingkat: Beranda -> halaman."""
    return {
        '@type': 'BreadcrumbList',
        'itemListElement': [
            {'@type': 'ListItem', 'position': 1, 'name': 'Beranda', 'item': DOMAIN + '/'},
            {'@type': 'ListItem', 'position': 2, 'name': judul, 'item': DOMAIN + jalur},
        ],
    }


def graf(jalur, judul, deskripsi, tambahan):
    """Bungkus beberapa potongan skema jadi satu graf @graph."""
    isi = [remah(judul, jalur)]
    isi.extend(tambahan)
    return {'@context': 'https://schema.org', '@graph': isi}


def skema_untuk(jalur):
    """Data terstruktur per halaman. Hanya yang benar-benar sesuai kenyataan."""
    if jalur == '/contoh/':
        return graf(jalur, 'Contoh soal psikotes gratis', 'contoh', [{
            '@type': 'LearningResource',
            'name': '40 contoh soal psikotes gratis dengan pembahasan',
            'description': ('40 contoh soal psikotes dari 8 jenis tes, lengkap dengan pembahasan '
                            'tiap soal. Bisa dikerjakan langsung tanpa akun dan tanpa bayar.'),
            'url': DOMAIN + '/contoh/',
            'inLanguage': 'id',
            'learningResourceType': 'Kuis latihan',
            'educationalLevel': 'Dewasa',
            'isAccessibleForFree': True,
            'teaches': ['Verbal', 'Penalaran', 'Numerik', 'Matematika dasar',
                        'Bahasa Inggris', 'Wawasan kebangsaan', 'Kraepelin', 'Kepribadian'],
            'publisher': {'@type': 'Organization', 'name': 'SiapPsikotes', 'url': DOMAIN + '/'},
            'isPartOf': {'@type': 'WebSite', 'name': 'SiapPsikotes', 'url': DOMAIN + '/'},
        }])
    if jalur == '/mutu/':
        return graf(jalur, 'Mutu dan bukti pemeriksaan soal', 'mutu', [{
            '@type': 'WebPage',
            'name': 'Mutu & bukti pemeriksaan soal SiapPsikotes',
            'description': ('Cara bank soal SiapPsikotes diperiksa: pedoman mutu soal, jumlah butir, '
                            'sebaran kunci jawaban, dan hasil pemeriksaan yang bisa diperiksa ulang.'),
            'url': DOMAIN + '/mutu/',
            'inLanguage': 'id',
            'isPartOf': {'@type': 'WebSite', 'name': 'SiapPsikotes', 'url': DOMAIN + '/'},
        }])
    if jalur == '/beli/':
        return graf(jalur, 'Harga dan cara beli', 'beli', [{
            '@type': 'Product',
            'name': 'Akses penuh SiapPsikotes',
            'description': ('Akses penuh aplikasi latihan psikotes: 1.348 soal, 9 jenis tes, '
                            'pembahasan tiap soal, dan Laporan Lengkap. Sekali bayar, bukan langganan.'),
            'url': DOMAIN + '/beli/',
            'brand': {'@type': 'Brand', 'name': 'SiapPsikotes'},
            'offers': {
                '@type': 'Offer',
                'price': '39000',
                'priceCurrency': 'IDR',
                'url': DOMAIN + '/beli/',
                'availability': 'https://schema.org/InStock',
                'seller': {'@type': 'Organization', 'name': 'SiapPsikotes'},
            },
        }])
    if jalur in ('/syarat/', '/privasi/'):
        judul = 'Syarat dan ketentuan' if jalur == '/syarat/' else 'Kebijakan privasi'
        return graf(jalur, judul, jalur, [{
            '@type': 'WebPage',
            'name': judul + ' SiapPsikotes',
            'description': ('Ketentuan pemakaian dan pembelian akses SiapPsikotes.'
                            if jalur == '/syarat/' else
                            'Cara SiapPsikotes menangani data latihan pengguna.'),
            'url': DOMAIN + jalur,
            'inLanguage': 'id',
            'isPartOf': {'@type': 'WebSite', 'name': 'SiapPsikotes', 'url': DOMAIN + '/'},
        }])
    return None


def tulis_peta_situs(kering):
    baris = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for berkas, jalur, prioritas, frekuensi in HALAMAN:
        if not os.path.exists(berkas):
            print('  LEWAT | berkas tidak ada: ' + berkas)
            continue
        baris.append('  <url>')
        baris.append('    <loc>%s</loc>' % (DOMAIN + jalur))
        baris.append('    <lastmod>%s</lastmod>' % tanggal_commit(berkas))
        baris.append('    <changefreq>%s</changefreq>' % frekuensi)
        baris.append('    <priority>%s</priority>' % prioritas)
        baris.append('  </url>')
    baris.append('</urlset>')
    isi = '\n'.join(baris) + '\n'
    if not kering:
        with open('sitemap.xml', 'w', encoding='utf-8') as f:
            f.write(isi)
    print('  OK    | sitemap.xml: %d halaman' % len([1 for b, *_ in HALAMAN if os.path.exists(b)]))


def tulis_robots(kering):
    isi = ('User-agent: *\nAllow: /\n\n'
           'Sitemap: %s/sitemap.xml\n' % DOMAIN)
    if not kering:
        with open('robots.txt', 'w', encoding='utf-8') as f:
            f.write(isi)
    print('  OK    | robots.txt menunjuk %s/sitemap.xml' % DOMAIN)


def pasang_ldjson(kering):
    for berkas, jalur, _, _ in HALAMAN:
        if not os.path.exists(berkas):
            continue
        with open(berkas, encoding='utf-8') as f:
            isi = f.read()
        if PENANDA in isi:
            print('  ADA   | %s sudah punya data terstruktur SEO' % berkas)
            continue
        skema = skema_untuk(jalur)
        if skema is None:
            print('  LEWAT | %s (tidak ada skema khusus)' % berkas)
            continue
        if 'application/ld+json' in isi:
            print('  ADA   | %s sudah punya ld+json sendiri - tidak ditimpa' % berkas)
            continue
        blok = ('\n' + PENANDA + '\n'
                '<script type="application/ld+json">'
                + json.dumps(skema, ensure_ascii=False, indent=1) + '</script>\n')
        if '</head>' not in isi:
            print('  GAGAL | %s tanpa </head>' % berkas)
            continue
        baru = isi.replace('</head>', blok + '</head>', 1)
        if not kering:
            with open(berkas, 'w', encoding='utf-8') as f:
                f.write(baru)
        print('  OK    | %s: data terstruktur dipasang' % berkas)


def periksa_halaman_baru():
    """Ingatkan bila ada folder halaman publik yang belum terdaftar di peta situs."""
    terdaftar = set(jalur.strip('/') for _, jalur, _, _ in HALAMAN)
    ditemukan = []
    for nama in sorted(os.listdir('.')):
        if not os.path.isdir(nama) or nama.startswith('.') or nama in ('static', 'data', 'tools', 'server', 'domain'):
            continue
        if os.path.exists(os.path.join(nama, 'index.html')) and nama not in terdaftar:
            ditemukan.append(nama)
    if ditemukan:
        print('  CATAT | halaman belum masuk peta situs: ' + ', '.join(ditemukan))
    else:
        print('  OK    | seluruh halaman publik sudah masuk peta situs')


def main():
    kering = '--periksa' in sys.argv
    print('PASANG SEO TEKNIS' + (' (mode periksa saja)' if kering else ''))
    print('1. peta situs')
    tulis_peta_situs(kering)
    print('2. robots.txt')
    tulis_robots(kering)
    print('3. data terstruktur (ld+json)')
    pasang_ldjson(kering)
    print('4. kelengkapan')
    periksa_halaman_baru()
    print('selesai.')


if __name__ == '__main__':
    main()

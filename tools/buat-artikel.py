#!/usr/bin/env python3
"""Bangun halaman artikel SEO dari berkas naskah + bank soal terverifikasi.

Kenapa soal TIDAK ditulis di naskah: akurasi soal dan pembahasan adalah prioritas
tertinggi produk ini. Semua soal artikel diambil apa adanya dari `data/soal-*.js`
yang sudah lolos `tools/peraturan-mutu.py`, jadi tidak ada risiko jawaban keliru.

Naskah artikel ditaruh di `naskah/artikel-<slug>.json` dengan bentuk:

{
  "slug": "contoh-soal-psikotes-kerja",
  "judul_tab": "...",              # <title>  (<= 60 huruf)
  "deskripsi": "...",              # meta description (<= 158 huruf)
  "h1": "...",
  "dek": "...",                    # kalimat pembuka di pita judul
  "kata_kunci": "...",
  "pembuka": ["paragraf", ...],
  "bagian": [
    {"h2": "...", "isi": ["paragraf"], "poin": ["butir"], "catatan": "..."},
    {"h2": "...", "tabel": {"kepala": ["..."], "baris": [["..."]]}},
    {"h2": "...", "soal": {"kategori": "verbal", "jumlah": 15}}
  ],
  "faq": [{"t": "pertanyaan", "j": "jawaban"}],
  "penutup": ["paragraf"],
  "tautan": [{"teks": "...", "url": "/contoh/"}],
  "diperbarui": "15 September 2026"
}

Pakai:
    /opt/homebrew/bin/python3 tools/buat-artikel.py            # seluruh naskah di .gen/
    /opt/homebrew/bin/python3 tools/buat-artikel.py --slug contoh-soal-psikotes-kerja
"""
import glob
import html
import json
import os
import re
import subprocess
import sys

AKAR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(AKAR, 'data')
BELI = os.path.join(AKAR, 'beli', 'index.html')
NASKAH = os.path.join(AKAR, 'naskah')
SITUS = 'https://siappsikotes.my.id'
ABJAD = 'ABCD'

PENYANGKAL = ('SiapPsikotes bukan produk resmi instansi mana pun dan tidak berafiliasi '
              'dengan lembaga pemerintah.')


def baca_berkas_soal(kategori):
    jalur = os.path.join(DATA, 'soal-%s.js' % kategori)
    isi = open(jalur, encoding='utf-8').read()
    m = re.search(r'=\s*(\{.*\})\s*;?\s*$', isi, re.S)
    if not m:
        raise SystemExit('pola berkas soal tidak dikenali: %s' % jalur)
    return json.loads(m.group(1))

def baca_bank_js(berkas, ekspresi):
    """Baca bank yang bukan JSON murni (kunci objeknya tanpa tanda kutip).

    Berkasnya tidak pernah disentuh: node mengevaluasi isinya apa adanya lalu
    mencetak JSON-nya. Dipakai hanya untuk bank yang memang tidak bisa dibaca
    `json.loads`, supaya bank yang sudah diaudit tetap utuh byte per byte.
    """
    jalur = os.path.join(DATA, berkas)
    skrip = ('const fs=require("fs");'
             'const src=fs.readFileSync(process.argv[1],"utf8");'
             'eval(src + "\\n;globalThis.__bank = %s;");'
             'process.stdout.write(JSON.stringify(globalThis.__bank));' % ekspresi)
    try:
        keluaran = subprocess.run(['node', '-e', skrip, jalur],
                                  capture_output=True, text=True, check=True)
    except (OSError, subprocess.CalledProcessError) as e:
        raise SystemExit('gagal membaca %s lewat node: %s' % (jalur, e))
    return json.loads(keluaran.stdout)

def pilih_merata(daftar, jumlah):
    langkah = max(1, len(daftar) // jumlah)
    terpilih = daftar[::langkah][:jumlah]
    for s in daftar:
        if len(terpilih) >= jumlah:
            break
        if s not in terpilih:
            terpilih.append(s)
    return terpilih[:jumlah]

def soal_psikologi(jenis, jumlah):
    """Soal lisan/daya ingat dari data/soal-psikologi.js, diambil apa adanya.

    Pembahasannya dirakit ulang dari angka atau `cara` milik bank dan diperiksa
    terhadap kunci bank, jadi tidak ada pembahasan karangan.
    """
    d = baca_bank_js('soal-psikologi.js', 'SOAL_PSIKOLOGI')
    if jenis == 'digit_span':
        soal = d['digit_span']['soal']
    elif jenis == 'aritmatika':
        soal = d['aritmatika']['soal']
    else:
        raise SystemExit('jenis soal psikologi tidak dikenal: %s' % jenis)
    if len(soal) < jumlah:
        raise SystemExit('soal %s hanya %d, diminta %d' % (jenis, len(soal), jumlah))

    keluaran = []
    for s in pilih_merata(soal, jumlah):
        if jenis == 'digit_span':
            angka = [str(a) for a in s['angka']]
            if s['tipe'] == 'mundur':
                benar = ''.join(reversed(angka))
                pertanyaan = ('Tulis kembali deret berikut secara mundur: %s'
                              % ' '.join(angka))
                pembahasan = 'Dibaca dari urutan paling belakang: %s → %s.' % (
                    '-'.join(reversed(angka)), benar)
            else:
                benar = ''.join(angka)
                pertanyaan = ('Tulis kembali deret berikut sesuai urutan yang kamu dengar: %s'
                              % ' '.join(angka))
                pembahasan = 'Deret dibaca apa adanya: %s → %s.' % ('-'.join(angka), benar)
            if benar != str(s['jawaban']):
                raise SystemExit('kunci bank %s tidak cocok: %s != %s'
                                 % (s['id'], benar, s['jawaban']))
            keluaran.append({'pertanyaan': pertanyaan, 'pilihan': [],
                             'pembahasan': pembahasan})
        else:
            keluaran.append({'pertanyaan': s['soal'], 'pilihan': [],
                             'pembahasan': '%s Jadi jawabannya %s.' % (s['cara'], s['jawaban'])})
    return keluaran


def ambil_soal(kategori, jumlah):
    """Ambil soal teks dari bank, tersebar rata, tanpa mengubah isinya sama sekali."""
    d = baca_berkas_soal(kategori)
    soal = [s for s in d.get('soal', []) if not s.get('gambar') and s.get('pilihan')]
    if len(soal) < jumlah:
        raise SystemExit('soal teks di %s hanya %d, diminta %d' % (kategori, len(soal), jumlah))
    langkah = max(1, len(soal) // jumlah)
    terpilih = []
    for i in range(0, len(soal), langkah):
        terpilih.append(soal[i])
        if len(terpilih) == jumlah:
            break
    i = 0
    while len(terpilih) < jumlah and i < len(soal):
        if soal[i] not in terpilih:
            terpilih.append(soal[i])
        i += 1
    return terpilih[:jumlah]


def gaya_halaman():
    """Salin blok <style> halaman /beli/ supaya satu keluarga tampilan."""
    isi = open(BELI, encoding='utf-8').read()
    return isi[isi.index('<style>'):isi.index('</style>') + len('</style>')]


# --- gaya tambahan khusus artikel (tidak mengubah gaya halaman lain) ---
GAYA_ARTIKEL = '''<style>
.artikel-kepala{max-width:760px}
.artikel p{line-height:1.75}
.daftar-isi{background:var(--surface2);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:16px 20px;margin:24px 0}
.daftar-isi p{margin:0 0 8px;color:var(--muted);font-size:.9rem;letter-spacing:.04em;text-transform:uppercase}
.daftar-isi ol{margin:0;padding-left:22px}
.daftar-isi a{color:#e6c552;text-decoration:none}
.daftar-isi a:hover{text-decoration:underline}
.tanya{border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:16px 18px;margin:16px 0;background:var(--surface2)}
.tanya-nomor{color:#e6c552;font-weight:700;margin-right:6px}
.tanya-teks{margin:0 0 10px;font-weight:600;color:var(--text)}
.tanya .pilih{list-style:upper-alpha;margin:0 0 10px;padding-left:24px;color:var(--isi)}
.tanya .pilih li{margin:2px 0}
.bahas{border-top:1px dashed rgba(255,255,255,.18);padding-top:10px}
.bahas summary{cursor:pointer;color:#e6c552;font-weight:600}
.bahas-isi{white-space:pre-line;margin:10px 0 0;color:var(--isi)}
.artikel table{width:100%;border-collapse:collapse;margin:18px 0;font-size:.95rem}
.artikel th,.artikel td{border:1px solid rgba(255,255,255,.16);padding:9px 11px;text-align:left;color:var(--isi)}
.artikel th{background:var(--surface2);color:var(--text)}
.artikel .catatan{background:var(--surface2);border-left:3px solid #e6c552;padding:12px 16px;border-radius:0 10px 10px 0;margin:18px 0}
.artikel .tautan-artikel{display:flex;flex-wrap:wrap;gap:10px;margin:22px 0}
@media (max-width:560px){
  .artikel table,.artikel thead,.artikel tbody,.artikel th,.artikel td,.artikel tr{display:block}
  .artikel thead{display:none}
  .artikel td{border:none;border-bottom:1px solid rgba(255,255,255,.12);padding:8px 0}
  .artikel td::before{content:attr(data-label);display:block;color:var(--muted);font-size:.82rem;margin-bottom:2px}
}
</style>'''


def kepala(n, gaya):
    kanon = '%s/%s/' % (SITUS, n['slug'])
    judul_tab = html.escape(n['judul_tab'], quote=True)
    deskripsi = html.escape(n['deskripsi'], quote=True)
    skema = build_skema(n, kanon)
    return '''<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'none'">
<meta name="referrer" content="strict-origin-when-cross-origin">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#0a0f18">
<title>%(judul)s</title>
<meta name="description" content="%(desk)s">
<meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="%(kanon)s">
<meta property="og:title" content="%(judul)s">
<meta property="og:description" content="%(desk)s">
<meta property="og:type" content="article">
<meta property="og:url" content="%(kanon)s">
<meta property="og:image" content="%(situs)s/og-image.png">
<meta property="og:locale" content="id_ID">
<meta property="og:site_name" content="SiapPsikotes">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/png" sizes="32x32" href="../static/icons/favicon-32.png">
<link rel="apple-touch-icon" sizes="180x180" href="../static/icons/apple-touch-icon-180.png">
<link rel="manifest" href="../manifest.json">
%(gaya)s
%(gaya_artikel)s
<script type="application/ld+json">%(skema)s</script>
</head>
<body>
<a class="lewati" href="#isi">Langsung ke isi</a>

<header>
  <div class="wrap kepala">
    <a class="merek" href="../"><img src="../static/icons/icon-192.png" alt="" width="30" height="30"><span>SiapPsikotes</span></a>
    <nav aria-label="Halaman">
      <a href="../psikotes/">Aplikasi latihan</a>
      <a href="../contoh/">Contoh gratis</a>
      <a href="../beli/">Harga</a>
      <a href="../mutu/">Mutu</a>
      <a class="tombol sekunder kecil" href="../beli/">Beli akses</a>
    </nav>
  </div>
</header>

<main id="isi" class="wrap artikel">

  <section class="pita artikel-kepala">
    <span class="lencana">Panduan</span>
    <h1>%(h1)s</h1>
    <p class="dek">%(dek)s</p>
  </section>
''' % dict(judul=judul_tab, desk=deskripsi, kanon=kanon, situs=SITUS,
           gaya=gaya, gaya_artikel=GAYA_ARTIKEL, skema=skema,
           h1=n['h1'], dek=n['dek'])


def build_skema(n, kanon):
    graf = [
        {'@type': 'BreadcrumbList', 'itemListElement': [
            {'@type': 'ListItem', 'position': 1, 'name': 'Beranda', 'item': SITUS + '/'},
            {'@type': 'ListItem', 'position': 2, 'name': n['h1'], 'item': kanon},
        ]},
        {'@type': 'Article',
         'headline': n['h1'],
         'description': n['deskripsi'],
         'inLanguage': 'id',
         'mainEntityOfPage': kanon,
         'datePublished': n.get('tanggal_terbit', '2026-09-15'),
         'dateModified': n.get('tanggal_terbit', '2026-09-15'),
         'author': {'@type': 'Organization', 'name': 'SiapPsikotes', 'url': SITUS + '/'},
         'publisher': {'@type': 'Organization', 'name': 'SiapPsikotes', 'url': SITUS + '/'},
         'isPartOf': {'@type': 'WebSite', 'name': 'SiapPsikotes', 'url': SITUS + '/'}},
    ]
    if n.get('faq'):
        graf.append({'@type': 'FAQPage', 'mainEntity': [
            {'@type': 'Question', 'name': f['t'],
             'acceptedAnswer': {'@type': 'Answer', 'text': f['j']}} for f in n['faq']]})
    return json.dumps({'@context': 'https://schema.org', '@graph': graf},
                      ensure_ascii=False, indent=1)


def paragraf(daftar):
    return '\n'.join('  <p>%s</p>' % t for t in daftar)


def render_soal(kategori, jumlah):
    soal = ambil_soal(kategori, jumlah)
    return rakit_soal(soal)

def rakit_soal(soal):
    keluar = []
    for i, s in enumerate(soal, 1):
        pilih = ''
        if s.get('pilihan'):
            pilih = '\n    <ol class="pilih">\n%s\n    </ol>' % '\n'.join(
                '      <li>%s</li>' % html.escape(str(p)) for p in s['pilihan'])
        keluar.append('''  <article class="tanya">
    <p class="tanya-teks"><span class="tanya-nomor">%d.</span>%s</p>
%s
    <details class="bahas">
      <summary>Lihat jawaban &amp; pembahasan</summary>
      <p class="bahas-isi">%s</p>
    </details>
  </article>''' % (i, html.escape(str(s['pertanyaan'])), pilih.lstrip('\n'),
                    html.escape(str(s['pembahasan']))))
    return '\n'.join(keluar), len(soal)


def render_tabel(t):
    kepala_t = ''.join('<th>%s</th>' % html.escape(str(k)) for k in t['kepala'])
    isi = ''
    for baris in t['baris']:
        sel = ''.join('<td data-label="%s">%s</td>' % (html.escape(str(t['kepala'][j])),
                                                       html.escape(str(v)))
                      for j, v in enumerate(baris))
        isi += '    <tr>%s</tr>\n' % sel
    return ('  <table>\n    <thead><tr>%s</tr></thead>\n    <tbody>\n%s    </tbody>\n  </table>'
            % (kepala_t, isi))


def isi_artikel(n):
    bagian = []
    daftar_isi = []
    for b in n['bagian']:
        jangkar = re.sub(r'[^a-z0-9]+', '-', b['h2'].lower()).strip('-')[:48]
        daftar_isi.append('      <li><a href="#%s">%s</a></li>' % (jangkar, b['h2']))
        potong = ['  <h2 id="%s">%s</h2>' % (jangkar, b['h2'])]
        if b.get('isi'):
            potong.append(paragraf(b['isi']))
        if b.get('poin'):
            potong.append('  <ul>\n%s\n  </ul>' % '\n'.join(
                '    <li>%s</li>' % t for t in b['poin']))
        if b.get('tabel'):
            potong.append(render_tabel(b['tabel']))
        if b.get('catatan'):
            potong.append('  <div class="catatan"><p>%s</p></div>' % b['catatan'])
        if b.get('soal'):
            blok = b['soal']
            if blok.get('psikologi'):
                html_soal, jml = rakit_soal(soal_psikologi(blok['psikologi'],
                                                           blok['jumlah']))
            else:
                html_soal, jml = render_soal(blok['kategori'], blok['jumlah'])
            potong.append(html_soal)
        bagian.append('\n'.join(potong))

    kepala_isi = ('  <div class="daftar-isi">\n    <p>Isi halaman</p>\n    <ol>\n%s\n    </ol>\n  </div>'
                  % '\n'.join(daftar_isi))

    faq = ''
    if n.get('faq'):
        faq = '\n  <h2 id="tanya-jawab">Pertanyaan yang sering muncul</h2>\n' + '\n'.join(
            '  <div class="tanya"><p class="tanya-teks">%s</p><p class="bahas-isi">%s</p></div>'
            % (html.escape(f['t']), html.escape(f['j'])) for f in n['faq'])

    tautan = ''
    if n.get('tautan'):
        tautan = ('\n  <div class="tautan-artikel">\n%s\n  </div>' %
                  '\n'.join('    <a class="tombol sekunder" href="%s">%s</a>'
                            % (t['url'], t['teks']) for t in n['tautan']))

    return (kepala_isi + '\n\n' + paragraf(n['pembuka']) + '\n\n' +
            '\n\n'.join(bagian) + '\n' + faq + '\n' + paragraf(n['penutup']) + '\n' + tautan)


def kaki(n):
    return '''
</main>

<footer>
  <div class="wrap">
    <p><strong style="color:#eaf1f8">SiapPsikotes</strong> &mdash; latihan psikotes kerja, tes IQ, dan tes kepribadian.</p>
    <div class="tautan-kaki">
      <a href="../psikotes/">Buka aplikasi latihan</a>
      <a href="../contoh/">40 soal contoh gratis</a>
      <a href="../beli/">Harga &amp; cara beli</a>
      <a href="../mutu/">Mutu &amp; bukti pemeriksaan</a>
      <a href="../syarat/">Syarat &amp; ketentuan</a>
      <a href="../privasi/">Kebijakan privasi</a>
    </div>
    <p>%s</p>
    <p>Seluruh soal di halaman ini diambil dari bank soal SiapPsikotes yang diperiksa dengan pedoman mutu yang dapat diperiksa ulang. Halaman ini bersifat latihan; hasil seleksi bergantung pada usaha pembaca.</p>
    <p>Halaman ini diperbarui %s.</p>
  </div>
</footer>
</body>
</html>
''' % (PENYANGKAL, n.get('diperbarui', '15 September 2026'))


def bangun_satu(naskah):
    n = json.load(open(naskah, encoding='utf-8'))
    for wajib in ('slug', 'judul_tab', 'deskripsi', 'h1', 'dek', 'pembuka', 'bagian', 'penutup'):
        if not n.get(wajib):
            raise SystemExit('naskah %s kekurangan kunci: %s' % (naskah, wajib))
    if len(n['judul_tab']) > 62:
        raise SystemExit('%s: judul_tab %d huruf (maks 62)' % (naskah, len(n['judul_tab'])))
    if len(n['deskripsi']) > 158:
        raise SystemExit('%s: deskripsi %d huruf (maks 158)' % (naskah, len(n['deskripsi'])))
    # pagar aturan jujur: kata yang dilarang tidak boleh muncul di naskah artikel
    terlarang = ['soal asli', 'soal resmi', 'dijamin', 'pasti lulus', 'pasti diterima',
                 'satu-satunya', 'nomor 1', 'terbaik', 'resmi tni', 'resmi polri',
                 'bekerja sama dengan', 'akurat 100%', 'gratis selamanya']
    gabung = json.dumps(n, ensure_ascii=False).lower()
    for kata in terlarang:
        if kata in gabung:
            raise SystemExit('%s: memuat kata terlarang "%s"' % (naskah, kata))

    tujuan = os.path.join(AKAR, n['slug'])
    os.makedirs(tujuan, exist_ok=True)
    isi = (kepala(n, gaya_halaman()) + isi_artikel(n) + kaki(n))
    keluaran = os.path.join(tujuan, 'index.html')
    with open(keluaran, 'w', encoding='utf-8') as f:
        f.write(isi)
    return n['slug'], len(isi), len(isi_artikel(n).split())


def main():
    hanya = None
    if '--slug' in sys.argv:
        hanya = sys.argv[sys.argv.index('--slug') + 1]
    berkas = sorted(glob.glob(os.path.join(NASKAH, 'artikel-*.json')))
    if hanya:
        berkas = [b for b in berkas if b.endswith('artikel-%s.json' % hanya)]
    if not berkas:
        raise SystemExit('tidak ada naskah di %s' % NASKAH)
    for b in berkas:
        slug, ukuran, kata = bangun_satu(b)
        print('  OK    | %s/index.html  (%d KB, ~%d kata)' % (slug, ukuran // 1024, kata))
    print('selesai. Ingat: tambahkan slug ke daftar HALAMAN di tools/pasang-seo.py '
          'lalu jalankan perkakas itu.')


if __name__ == '__main__':
    main()

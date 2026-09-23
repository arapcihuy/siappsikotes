#!/usr/bin/env python3
"""Bangun halaman /contoh/ — 40 soal gratis berpembahasan sebagai umpan.

Ambil 5 soal teks dari tiap jenis tes (soal bergambar dilewati karena halaman ini
tanpa gambar), salin gaya halaman pendukung dari /beli/ supaya satu keluarga
tampilan, lalu tulis contoh/index.html.

Langkah terakhir memanggil tools/sisip-contoh-statis.py supaya salinan 40 soal yang
terbaca tanpa JavaScript selalu ikut; tanpa itu halaman ini hanya kerangka kosong
di mata perayap dan pembaca layar. Satu perintah menghasilkan halaman yang lengkap.

Pakai:  /usr/bin/python3 tools/buat-contoh.py
"""
import json
import os
import re
import subprocess
import sys

AKAR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(AKAR, 'data')
BELI = os.path.join(AKAR, 'beli', 'index.html')
KELUAR = os.path.join(AKAR, 'contoh', 'index.html')
SITUS = 'https://siappsikotes.my.id'
PER_KATEGORI = 5
# Ukuran bank soal penuh di aplikasi (1.225 soal latihan + 123 soal tambahan seperti tes
# gambar), dipakai untuk persentase halaman dan untuk angka "sisa" di kartu hasil.
BANK_SOAL = 1348

# Penanda satu-satunya dari halaman ini: kode tetap yang dikirim SEKALI saat pembaca
# menuntaskan 40 soal. Dihitung di server lewat peristiwa 'ruang' (rincian = 6 huruf
# terakhir kode). Tanpa data pribadi; halaman tetap berjalan walau ping-nya gagal.
PING_KODE = 'SPCONTOHSELESAI407OD1'
PING_ALAMAT = 'https://siappsikotes-api.rasyidahmad180.workers.dev/api/ruang/masuk'

# Urutan tampil + nama panjang tiap jenis tes (samakan dengan DATA_SOAL_INDEX).
JENIS = [
    ('verbal', 'Kemampuan Verbal'),
    ('penalaran_logika', 'Penalaran &amp; Logika'),
    ('numerik', 'Kemampuan Numerik'),
    ('matematika', 'Matematika'),
    ('bahasa_inggris', 'Bahasa Inggris'),
    ('tkw', 'Wawasan Kebangsaan'),
    ('kraepelin', 'Tes Kraepelin (hitung cepat)'),
    ('kepribadian', 'Tes Kepribadian Situasional'),
]


def baca_berkas_soal(nama):
    jalur = os.path.join(DATA, 'soal-%s.js' % nama)
    isi = open(jalur, encoding='utf-8').read()
    m = re.search(r'=\s*(\{.*\})\s*;?\s*$', isi, re.S)
    if not m:
        raise SystemExit('pola berkas soal tidak dikenali: %s' % jalur)
    return json.loads(m.group(1))


def pilih(kunci, nama, jumlah):
    """Ambil `jumlah` soal teks yang tersebar rata, bukan menumpuk di satu topik."""
    d = baca_berkas_soal(nama)
    soal = [s for s in d.get('soal', []) if not s.get('gambar')]
    if not soal:
        raise SystemExit('tidak ada soal teks di %s' % nama)
    langkah = max(1, len(soal) // jumlah)
    terpilih = []
    for i in range(0, len(soal), langkah):
        terpilih.append(soal[i])
        if len(terpilih) == jumlah:
            break
    # pastikan tetap dapat jumlah yang diminta walau langkah membulat
    i = 0
    while len(terpilih) < jumlah and i < len(soal):
        if soal[i] not in terpilih:
            terpilih.append(soal[i])
        i += 1
    keluaran = []
    for s in terpilih[:jumlah]:
        keluaran.append({
            't': s['pertanyaan'],
            'p': list(s['pilihan']),
            'j': int(s['jawaban']),
            'b': s['pembahasan'],
            'k': kunci,
            'n': nama.replace('_', ' ').split('-')[0].strip(),
            'topik': s.get('topik', ''),
        })
    return keluaran


def gaya_dari_beli():
    """Salin blok <style> halaman /beli/ supaya halaman ini satu keluarga tampilan."""
    isi = open(BELI, encoding='utf-8').read()
    awal = isi.index('<style>')
    akhir = isi.index('</style>') + len('</style>')
    return isi[awal:akhir]


def kartu_pilihan(pilihan):
    abjad = 'ABCD'
    baris = []
    for i, teks in enumerate(pilihan):
        baris.append('      <button type="button" class="pilih" data-i="%d">'
                     '<span class="abjad">%s</span><span class="teks">%s</span></button>'
                     % (i, abjad[i] if i < len(abjad) else str(i + 1), teks))
    return '\n'.join(baris)


def sisipkan_salinan_statis():
    """Jalankan penyisip salinan statis sebagai langkah terakhir.

    Halaman ini menggambar 40 soalnya dengan JavaScript; tanpa salinan statis
    mesin pencari dan pengunjung tanpa skrip hanya melihat kerangka kosong.
    Dulu langkah itu alat terpisah yang harus diingat manusia, sehingga
    pembuatan ulang halaman diam-diam menghapus salinannya. Sekarang satu
    perintah menghasilkan halaman yang lengkap.
    """
    alat = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sisip-contoh-statis.py')
    hasil = subprocess.run([sys.executable, alat], capture_output=True, text=True)
    sys.stdout.write(hasil.stdout)
    if hasil.returncode != 0:
        print('MASALAH: penyisipan salinan statis gagal (kode %d)' % hasil.returncode)
        if hasil.stderr:
            sys.stderr.write(hasil.stderr)
    return hasil.returncode

def blok_seo_tambahan(semua):
    """JSON-LD Quiz (Practice problems) + FAQPage untuk contoh soal gratis.

    Soalnya sama persis dengan yang tampil di halaman, dan tiap jawaban benar
    diambil dari kunci soal itu sendiri. FAQ cuma mengulang kalimat yang sudah
    terbaca pengunjung di halaman ini, karena data terstruktur harus cocok
    dengan isi yang terlihat.
    """
    bagian = []
    for s in semua:
        bagian.append({
            '@type': 'Question',
            'eduQuestionType': 'Multiple choice',
            'name': s['t'],
            'acceptedAnswer': {'@type': 'Answer', 'text': s['p'][s['j']]},
            'suggestedAnswer': [
                {'@type': 'Answer', 'text': teks}
                for i, teks in enumerate(s['p']) if i != s['j']
            ],
        })
    kuis = {
        '@type': 'Quiz',
        'name': '%d contoh soal psikotes gratis (pilihan ganda, ada pembahasan)' % len(semua),
        'description': ('%d contoh soal psikotes dari 8 jenis tes dengan pembahasan, '
                        'bisa dikerjakan langsung tanpa akun dan tanpa bayar.' % len(semua)),
        'url': SITUS + '/contoh/',
        'inLanguage': 'id',
        'educationalLevel': 'Dewasa',
        'isAccessibleForFree': True,
        'about': {'@type': 'Thing', 'name': 'Psikotes'},
        'hasPart': bagian,
    }
    tanya = [
        ('Apakah contoh soal di halaman ini gratis?',
         'Ya. Halaman ini gratis, tanpa akun, dan tanpa bayar.'),
        ('Berapa banyak contoh soal psikotes di halaman ini?',
         '%d contoh soal dari 8 jenis tes, lengkap dengan pembahasan.' % len(semua)),
        ('Apakah setiap soal punya pembahasan?',
         'Punya. Pilih jawabanmu, lalu pembahasan langkah demi langkah terbuka.'),
        ('Apakah SiapPsikotes produk resmi instansi?',
         'SiapPsikotes bukan produk resmi instansi mana pun dan tidak berafiliasi '
         'dengan lembaga pemerintah.'),
    ]
    faq = {
        '@type': 'FAQPage',
        'mainEntity': [
            {
                '@type': 'Question',
                'name': t,
                'acceptedAnswer': {'@type': 'Answer', 'text': j},
            }
            for t, j in tanya
        ],
    }
    blok = []
    for obj in (kuis, faq):
        teks = json.dumps(obj, ensure_ascii=False, indent=1)
        blok.append('\n'.join('  ' + baris for baris in teks.splitlines()))
    return ',\n' + ',\n'.join(blok)

def bangun():
    semua = []
    for kunci, nama in JENIS:
        semua.extend(pilih(kunci, kunci, PER_KATEGORI))
    total = len(semua)

    data_js = json.dumps(semua, ensure_ascii=False, separators=(',', ':'))
    gaya = gaya_dari_beli()

    html = '''<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline' https://accounts.google.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.googleusercontent.com https://www.gstatic.com; connect-src 'self' https://accounts.google.com https://www.googleapis.com https://siappsikotes-api.rasyidahmad180.workers.dev; frame-src https://accounts.google.com; object-src 'none'; base-uri 'self'; form-action 'none'">
<meta name="referrer" content="strict-origin-when-cross-origin">

<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#0a0f18">
<title>Contoh Soal Psikotes Gratis + Pembahasan — SiapPsikotes</title>
<meta name="description" content="%(jumlah)d contoh soal psikotes dari 8 jenis tes, lengkap dengan pembahasan. Kerjakan langsung di halaman ini, tanpa akun dan tanpa bayar.">
<link rel="canonical" href="%(situs)s/contoh/">
<meta property="og:title" content="Contoh Soal Psikotes Gratis + Pembahasan">
<meta property="og:description" content="%(jumlah)d soal dari 8 jenis tes: verbal, penalaran, numerik, matematika, bahasa Inggris, wawasan kebangsaan, kraepelin, dan kepribadian. Jawab langsung, pembahasan terbuka.">
<meta property="og:type" content="website">
<meta property="og:url" content="%(situs)s/contoh/">
<meta property="og:image" content="%(situs)s/static/og/contoh.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Contoh Soal Psikotes Gratis + Pembahasan">
<meta name="twitter:image" content="%(situs)s/static/og/contoh.png">
<meta name="twitter:image:alt" content="Contoh Soal Psikotes Gratis + Pembahasan">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/png" sizes="32x32" href="../static/icons/favicon-32.png">
<link rel="icon" type="image/png" sizes="192x192" href="../static/icons/icon-192.png">
<link rel="apple-touch-icon" sizes="180x180" href="../static/icons/apple-touch-icon-180.png">
%(gaya)s
<style>
  /* ---------- khusus halaman contoh soal ---------- */
  .alat-contoh { position:sticky; top:64px; z-index:9; display:flex; flex-wrap:wrap; align-items:center;
    gap:10px; margin:0 0 20px; padding:12px 14px; border:1px solid var(--line2); border-radius:14px;
    background:rgba(18,26,40,.94); backdrop-filter:blur(8px); }
  .alat-contoh .hitung { font-weight:700; font-size:14.5px; margin-right:auto; }
  .alat-contoh label { font-size:14px; color:var(--muted); }
  .alat-contoh select { min-height:38px; padding:8px 10px; border-radius:10px; font:inherit; font-size:14px;
    background:#1e2a3d; color:var(--text); border:1px solid rgba(255,255,255,.28); }
  .kartu-soal { border:1px solid var(--line); border-radius:16px; padding:18px 18px 6px; margin:0 0 16px;
    background:linear-gradient(180deg, rgba(255,255,255,.045), rgba(255,255,255,.008)); }
  .kartu-soal[hidden] { display:none; }
  .kartu-kepala { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:10px; }
  .kartu-jenis { font-size:12px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; color:var(--gold); }
  .kartu-nomor { font-size:13px; color:var(--muted); }
  .kartu-tanya { font-size:17px; font-weight:600; margin:0 0 14px; white-space:pre-wrap; }
  .kartu-pilih { display:grid; gap:9px; margin-bottom:14px; }
  .pilih { display:flex; align-items:flex-start; gap:11px; width:100%%; text-align:left; cursor:pointer;
    min-height:44px; padding:11px 14px; border-radius:12px; font:inherit; font-size:16px;
    background:#1e2a3d; color:var(--text); border:1px solid rgba(255,255,255,.22); transition:border-color .15s ease; }
  .pilih:hover { border-color:var(--gold); }
  .pilih .abjad { display:inline-flex; align-items:center; justify-content:center; flex:0 0 24px;
    height:24px; border-radius:7px; background:rgba(255,255,255,.12); font-size:13px; font-weight:700; }
  .pilih.benar { border-color:var(--ok); background:rgba(74,222,128,.14); }
  .pilih.benar .abjad { background:var(--ok); color:#07240f; }
  .pilih.salah { border-color:#f87171; background:rgba(248,113,113,.14); }
  .pilih.salah .abjad { background:#f87171; color:#2a0b0b; }
  .pilih[disabled] { cursor:default; }
  .kartu-bahas { border-top:1px solid var(--line); margin:0 0 14px; padding-top:12px; }
  .bahas-judul { margin:0 0 6px; font-size:12.5px; font-weight:800; letter-spacing:.08em;
    text-transform:uppercase; color:var(--blue); }
  .bahas-isi { margin:0; color:var(--isi); font-size:15.5px; white-space:pre-wrap; }
  .kartu-soal.dijawab { border-color:var(--line2); }
  @media (max-width:700px) { .alat-contoh { top:56px; } }

  /* ---- hasil latihan: bilah tetap di bawah, muncul setelah cukup banyak dijawab ---- */
  #contoh-hasil {
    position:fixed; left:0; right:0; bottom:0; z-index:40;
    display:none; align-items:center; gap:14px; flex-wrap:wrap;
    padding:12px max(16px, calc((100vw - 1000px) / 2));
    background:linear-gradient(180deg, rgba(18,26,40,.96), rgba(10,15,24,.99));
    border-top:1px solid var(--line2);
    box-shadow:0 -10px 28px rgba(0,0,0,.45);
  }
  #contoh-hasil.tampil { display:flex; }
  body.ada-hasil { padding-bottom:104px; }
  .hasil-skor { display:flex; align-items:baseline; gap:8px; margin-right:auto; min-width:0; }
  .hasil-angka { font-size:clamp(22px,4vw,30px); font-weight:800; color:var(--gold);
    letter-spacing:-.02em; line-height:1; }
  .hasil-kata { color:var(--muted); font-size:14.5px; line-height:1.45; }
  .hasil-kata b { color:var(--text); }
  .hasil-aksi { display:flex; gap:10px; }
  @media (max-width:560px) {
    #contoh-hasil { padding:10px 14px; gap:8px; }
    .hasil-skor { margin-right:0; }
    .hasil-aksi { width:100%%; }
    .hasil-aksi .tombol { flex:1; text-align:center; }
  }
</style>
<!-- statis-gaya:mulai -->
<style>
  .statis-pilih { margin:0 0 14px; padding-left:22px; }
  .statis-pilih li { margin:0 0 6px; }
  .statis-kunci { font-weight:700; color:var(--ok); }
</style>
<!-- statis-gaya:selesai -->

<!-- seo:terpasang -->
<script type="application/ld+json">{
 "@context": "https://schema.org",
 "@graph": [
  {
   "@type": "BreadcrumbList",
   "itemListElement": [
    {
     "@type": "ListItem",
     "position": 1,
     "name": "Beranda",
     "item": "%(situs)s/"
    },
    {
     "@type": "ListItem",
     "position": 2,
     "name": "Contoh soal psikotes gratis",
     "item": "%(situs)s/contoh/"
    }
   ]
  },
  {
   "@type": "LearningResource",
   "name": "%(jumlah)d contoh soal psikotes gratis dengan pembahasan",
   "description": "%(jumlah)d contoh soal psikotes dari 8 jenis tes, lengkap dengan pembahasan tiap soal. Bisa dikerjakan langsung tanpa akun dan tanpa bayar.",
   "url": "%(situs)s/contoh/",
   "inLanguage": "id",
   "learningResourceType": "Kuis latihan",
   "educationalLevel": "Dewasa",
   "isAccessibleForFree": true,
   "teaches": [
    "Verbal",
    "Penalaran",
    "Numerik",
    "Matematika dasar",
    "Bahasa Inggris",
    "Wawasan kebangsaan",
    "Kraepelin",
    "Kepribadian"
   ],
   "publisher": {
    "@type": "Organization",
    "name": "SiapPsikotes",
    "url": "%(situs)s/"
   },
   "isPartOf": {
    "@type": "WebSite",
    "name": "SiapPsikotes",
    "url": "%(situs)s/"
   }
  }%(seo_kuis)s
 ]
}</script>
</head>
<body>
<a class="lewati" href="#isi">Langsung ke isi</a>

<header>
  <div class="wrap kepala">
    <a class="merek" href="../"><img src="../static/icons/icon-192.png" alt="" width="30" height="30"><span>SiapPsikotes</span></a>
    <nav aria-label="Halaman">
      <a href="../contoh/" aria-current="page">Contoh gratis</a>
      <a href="../beli/">Beli</a>
      <a href="../mutu/">Mutu</a>
      <a href="../privasi/">Privasi</a>
      <a class="tombol sekunder kecil" href="../beli/">Harga &amp; cara beli</a>
    </nav>
  </div>
</header>

<main id="isi" class="wrap">
  <section class="pita">
    <span class="lencana">Gratis &middot; tanpa akun &middot; tanpa bayar</span>
    <h1>%(jumlah)d contoh soal psikotes, lengkap dengan pembahasan</h1>
    <p class="dek">Ini soal asli dari bank soal SiapPsikotes — bukan contoh karangan. Pilih jawabanmu,
      lalu pembahasan langkah demi langkah terbuka. Kalau cara ini cocok untukmu, di aplikasi tersedia
      <strong>1.348 soal</strong> dari 9 jenis tes dengan sekali bayar Rp 39.000.</p>
    <div class="aksi">
      <a class="tombol" href="../beli/">Buka semua 1.348 soal &mdash; Rp 39.000</a>
      <a class="tombol sekunder" href="../">Buka aplikasi</a>
    </div>
  </section>

  <div class="alat-contoh">
    <span class="hitung" id="contoh-hitung" aria-live="polite">0 dari %(jumlah)d soal dijawab</span>
    <label for="contoh-jenis">Jenis tes</label>
    <select id="contoh-jenis">
      <option value="">Semua jenis</option>
%(opsi)s
    </select>
    <button type="button" class="tombol sekunder kecil" id="contoh-acak">Acak urutan</button>
    <button type="button" class="tombol sekunder kecil" id="contoh-ulang">Mulai ulang</button>
  </div>

  <div id="contoh-daftar"></div>

  <div id="contoh-hasil">
    <span class="hasil-skor">
      <span class="hasil-angka" id="contoh-hasil-angka">0/0</span>
      <span class="hasil-kata" id="contoh-hasil-kata" aria-live="polite"></span>
    </span>
    <span class="hasil-aksi">
      <a class="tombol" id="contoh-bagi" href="#" target="_blank" rel="noopener">Bagikan hasil</a>
      <a class="tombol sekunder" href="../beli/">Buka versi lengkap</a>
    </span>
  </div>

  <section class="pita" style="margin-top:30px">
    <h2 style="margin:0 0 10px;font-size:clamp(22px,3.2vw,28px)">Sudah terlihat polanya?</h2>
    <p class="dek">Yang barusan kamu kerjakan itu %(persen)d%% dari bank soal. Di aplikasi, sisa
      <strong>1.308 soal</strong> menunggu bersama 9 modul tes, pembahasan tiap soal, riwayat latihan,
      dan Laporan Lengkap kesiapan seleksimu. Sekali bayar Rp 39.000, tanpa langganan.</p>
    <p class="dek" style="margin-top:10px">Soal bergambar (Tes Gambar dan kolom hitung Kraepelin)
      tidak bisa dimuat di halaman ringan ini — semuanya ada di dalam aplikasi.</p>
    <div class="aksi">
      <a class="tombol" href="../beli/">Beli akses penuh Rp 39.000</a>
      <a class="tombol sekunder" href="../psikotes/">Baca dulu isi paketnya</a>
    </div>
  </section>

  <hr>
  <h2 style="font-size:22px">Cara memakai halaman ini</h2>
  <ol class="langkah">
    <li>Kerjakan tanpa melihat pembahasan lebih dulu — itu cara tercepat tahu kesiapanmu.</li>
    <li>Salah itu wajar; yang penting baca pembahasannya sampai paham polanya.</li>
    <li>Hitung berapa yang benar. Kalau di bawah 70%%, berarti masih perlu latihan teratur.</li>
    <li>Butuh soal lebih banyak? Semua ada di aplikasi, tersimpan di perangkatmu, bisa dipakai offline.</li>
  </ol>
</main>

<footer>
  <div class="wrap">
    <p><strong style="color:#eaf1f8">SiapPsikotes</strong> &mdash; latihan psikotes kerja, tes IQ, dan tes kepribadian.</p>
    <div class="tautan-kaki">
      <a href="../">Buka aplikasi</a>
      <a href="../beli/">Harga &amp; cara beli</a>
      <a href="../mutu/">Mutu &amp; bukti pemeriksaan</a>
      <a href="../privasi/">Kebijakan privasi</a>
    </div>
    <p>SiapPsikotes bukan produk resmi instansi mana pun dan tidak berafiliasi dengan lembaga pemerintah.</p>
    <p>Halaman ini diperbarui 17 September 2026.</p>
  </div>
</footer>

<script>
window.CONTOH_SOAL = %(data)s;
(function () {
  var data = window.CONTOH_SOAL || [];
  var daftar = document.getElementById('contoh-daftar');
  var hitung = document.getElementById('contoh-hitung');
  var saring = document.getElementById('contoh-jenis');
  var terjawab = 0;
  var benar = 0;
  var perKategori = {};
  var AMBANG_HASIL = 5;
  var SITUS_CONTOH = '%(situs)s/contoh/';
  var BANK_SOAL = %(bank)d;
  var PING_ALAMAT = '%(ping_alamat)s';
  var PING_KODE = '%(ping_kode)s';
  var pingTerkirim = false;
  var pesanBagikan = '';
  var berkasKartu = null;

  // Satu ping anonim saat soal terakhir dijawab: memberi tahu API bahwa ada orang yang
  // menuntaskan contoh gratis. Isinya hanya kode tetap milik halaman ini - tanpa jawaban,
  // tanpa identitas, tanpa penyimpanan di peramban. Ping gagal (offline, API mati, atau
  // diblokir) tidak pernah menghalangi pembaca: hasilnya tetap tampil seperti biasa.
  function kirimPingSelesai() {
    if (pingTerkirim || terjawab < data.length) return;
    pingTerkirim = true;
    try {
      fetch(PING_ALAMAT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kode: PING_KODE }),
        keepalive: true
      }).catch(function () {});
    } catch (e) {}
  }

  // Kartu hasil: satu gambar yang dibawa pembaca ke grup WhatsApp-nya sendiri. Isinya hanya
  // keadaan halaman ini (skor, topik terlemah, alamat, harga) dan digambar di peramban pembaca -
  // halaman tidak pernah mengirim apa pun atas nama siapa pun. Gambar ini yang membuat kiriman
  // tetap terbaca ketika pratinjau tautan tidak dirender, karena alamatnya tercetak di gambar.
  // Objeknya ditaruh di window.CONTOH_KARTU sebagai pegangan uji gerbang (sama seperti
  // window.CONTOH_SOAL), supaya teks yang benar-benar digambar bisa diperiksa.
  var KARTU_LEBAR = 1080, KARTU_TINGGI = 1350;
  var KARTU_HURUF = '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif';

  function hurufBerspasi(g, isi, x, y, jarak) {
    var maju = 0;
    for (var i = 0; i < isi.length; i++) {
      g.fillText(isi.charAt(i), x + maju, y);
      maju += g.measureText(isi.charAt(i)).width + jarak;
    }
  }

  function tulis(g, isi, x, y, ukuran, warna, tebal, maks) {
    tebal = tebal || 700;
    maks = maks || 888;
    do {
      g.font = tebal + ' ' + ukuran + 'px ' + KARTU_HURUF;
      ukuran -= 2;
    } while (g.measureText(isi).width > maks && ukuran > 20);
    g.fillStyle = warna;
    g.fillText(isi, x, y);
    return isi;
  }

  function gambarKartu(lemah, persen) {
    var c = document.createElement('canvas');
    c.width = KARTU_LEBAR; c.height = KARTU_TINGGI;
    var g = c.getContext('2d');
    var teks = [];

    g.fillStyle = '#0a0f18';
    g.fillRect(0, 0, KARTU_LEBAR, KARTU_TINGGI);
    var kuning = g.createRadialGradient(150, 60, 0, 150, 60, 900);
    kuning.addColorStop(0, 'rgba(230,197,82,.17)');
    kuning.addColorStop(1, 'rgba(230,197,82,0)');
    g.fillStyle = kuning; g.fillRect(0, 0, KARTU_LEBAR, KARTU_TINGGI);
    var biru = g.createRadialGradient(960, 40, 0, 960, 40, 820);
    biru.addColorStop(0, 'rgba(109,179,255,.15)');
    biru.addColorStop(1, 'rgba(109,179,255,0)');
    g.fillStyle = biru; g.fillRect(0, 0, KARTU_LEBAR, KARTU_TINGGI);

    g.strokeStyle = 'rgba(255,255,255,.14)';
    g.lineWidth = 2;
    g.strokeRect(48, 48, KARTU_LEBAR - 96, KARTU_TINGGI - 96);
    g.strokeStyle = '#e6c552'; g.lineWidth = 6;
    [[48, 48, 1, 1], [KARTU_LEBAR - 48, 48, -1, 1],
     [48, KARTU_TINGGI - 48, 1, -1], [KARTU_LEBAR - 48, KARTU_TINGGI - 48, -1, -1]]
      .forEach(function (p) {
        g.beginPath();
        g.moveTo(p[0] + 52 * p[2], p[1]);
        g.lineTo(p[0], p[1]);
        g.lineTo(p[0], p[1] + 52 * p[3]);
        g.stroke();
      });

    g.font = '700 30px ' + KARTU_HURUF;
    g.fillStyle = '#6db3ff';
    var kepala = 'SIAPPSIKOTES \u00b7 CONTOH SOAL GRATIS';
    hurufBerspasi(g, kepala, 96, 168, 6);
    teks.push(kepala);
    g.fillStyle = '#e6c552'; g.fillRect(96, 196, 168, 4);

    g.font = '600 34px ' + KARTU_HURUF; g.fillStyle = '#b3c0d1';
    hurufBerspasi(g, 'HASIL LATIHANMU', 96, 292, 7);
    teks.push('HASIL LATIHANMU');

    teks.push(tulis(g, benar + '/' + terjawab, 90, 572, 300, '#e6c552', 800));
    teks.push(tulis(g, 'benar \u00b7 ' + persen + '%%', 96, 676, 46, '#eaf1f8', 600));
    if (lemah && lemah.rasio < 0.7) {
      teks.push(tulis(g, 'Paling perlu dilatih: ' + lemah.nama, 96, 756, 38, '#c9d5e3', 500));
    }

    g.fillStyle = 'rgba(230,197,82,.38)'; g.fillRect(96, 848, 888, 2);
    teks.push(tulis(g, 'Sisa ' + (BANK_SOAL - data.length).toLocaleString('id-ID') +
      ' soal + pembahasan di aplikasi', 96, 936, 50, '#eaf1f8', 700));
    teks.push(tulis(g, 'Rp 39.000 sekali bayar, tanpa langganan', 96, 1008, 50, '#e6c552', 700));

    teks.push(tulis(g, 'siappsikotes.my.id/contoh/', 96, 1188, 46, '#6db3ff', 700));
    teks.push(tulis(g, 'Tanpa akun \u00b7 tanpa afiliasi dengan instansi mana pun',
      96, 1252, 28, '#b3c0d1', 400));

    window.CONTOH_KARTU = { kanvas: c, teks: teks };
    return { kanvas: c, teks: teks };
  }

  // Kartu disiapkan ulang setiap bilah hasil berubah, bukan saat tombol diklik: peramban
  // hanya mengizinkan navigator.share dipanggil di dalam gestur pengguna, sedangkan
  // kanvas.toBlob() asinkron. Dengan berkas yang sudah ada, klik langsung bisa membagikan.
  // JPEG mutu 0,9 dipilih, bukan PNG: PNG kartu ini keluar ~960 KB (gradien gelap tidak
  // terkompresi rapi) dan terlalu berat untuk kiriman WhatsApp dari sambungan seluler.
  function siapkanKartu(lemah, persen) {
    berkasKartu = null;
    try {
      var kartu = gambarKartu(lemah, persen);
      if (!kartu.kanvas.toBlob) return;
      kartu.kanvas.toBlob(function (b) {
        if (!b) return;
        try {
          berkasKartu = new File([b], 'hasil-siappsikotes.jpg', { type: 'image/jpeg' });
        } catch (e) {}
      }, 'image/jpeg', 0.9);
    } catch (e) {}
  }

  // Bilah hasil: memperlihatkan skor sementara dan topik terlemah, lalu mengajak membagikannya.
  // Tombol "Bagikan hasil" membawa gambar kartu lewat navigator.share bila peramban mendukung;
  // kalau tidak, ia tetap tautan WhatsApp berisi pesan yang dikirim pembaca sendiri.
  // Satu-satunya kiriman dari halaman ini adalah ping anonim di kirimPingSelesai().
  function perbaruiHasil() {
    var bilah = document.getElementById('contoh-hasil');
    if (!bilah) return;
    if (terjawab < AMBANG_HASIL) {
      bilah.classList.remove('tampil');
      document.body.classList.remove('ada-hasil');
      return;
    }
    var persen = Math.round((benar / terjawab) * 100);
    var lemah = null;
    Object.keys(perKategori).forEach(function (nama) {
      var p = perKategori[nama];
      if (!p.t) return;
      var rasio = p.b / p.t;
      if (!lemah || rasio < lemah.rasio) lemah = { nama: nama, rasio: rasio };
    });
    var angka = document.getElementById('contoh-hasil-angka');
    var kata = document.getElementById('contoh-hasil-kata');
    var bagi = document.getElementById('contoh-bagi');
    if (angka) angka.textContent = benar + '/' + terjawab;
    if (kata) {
      kata.textContent = 'benar (' + persen + '%%)' +
        (lemah && lemah.rasio < 0.7 ? ' \\u00b7 paling perlu dilatih: ' + lemah.nama : '') +
        (terjawab < data.length ? ' \\u00b7 sisa ' + (data.length - terjawab) + ' soal' : ' \\u00b7 semua soal terjawab');
    }
    if (bagi) {
      var pesan = 'Aku baru mengerjakan contoh soal psikotes gratis di SiapPsikotes: benar ' +
        benar + ' dari ' + terjawab + ' soal (' + persen + '%%)' +
        (lemah && lemah.rasio < 0.7 ? ', terlemah ' + lemah.nama : '') +
        '. Cobain juga, tanpa akun: ' + SITUS_CONTOH;
      pesanBagikan = pesan;
      bagi.setAttribute('href', 'https://wa.me/?text=' + encodeURIComponent(pesan));
    }
    siapkanKartu(lemah, persen);
    bilah.classList.add('tampil');
    document.body.classList.add('ada-hasil');
  }

  function perbaruiHitung() {
    hitung.textContent = terjawab + ' dari ' + data.length + ' soal dijawab' +
      (terjawab ? ' · benar ' + benar : '');
  }

  function buatDaftar() {
    daftar.innerHTML = '';
    data.forEach(function (s, i) {
      if (saring && saring.value && s.k !== saring.value) return;
      var a = document.createElement('article');
      a.className = 'kartu-soal';
      a.setAttribute('data-kunci', s['k']);
      var pilih = document.createElement('div');
      pilih.className = 'kartu-pilih';
      pilih.setAttribute('role', 'group');
      pilih.setAttribute('aria-label', 'Pilihan jawaban');
      s.p.forEach(function (teks, j) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'pilih';
        b.setAttribute('data-i', String(j));
        var ab = document.createElement('span');
        ab.className = 'abjad';
        ab.textContent = 'ABCD'.charAt(j) || String(j + 1);
        var tx = document.createElement('span');
        tx.className = 'teks';
        tx.textContent = teks;
        b.appendChild(ab);
        b.appendChild(tx);
        b.addEventListener('click', function () { jawab(a, pilih, s, j); });
        pilih.appendChild(b);
      });
      var kepala = document.createElement('div');
      kepala.className = 'kartu-kepala';
      var jen = document.createElement('span');
      jen.className = 'kartu-jenis';
      jen.textContent = s.n;
      var nom = document.createElement('span');
      nom.className = 'kartu-nomor';
      nom.textContent = (i + 1) + '/' + data.length;
      kepala.appendChild(jen);
      kepala.appendChild(nom);
      var tanya = document.createElement('p');
      tanya.className = 'kartu-tanya';
      tanya.textContent = s.t;
      var bahas = document.createElement('div');
      bahas.className = 'kartu-bahas';
      bahas.hidden = true;
      var bj = document.createElement('p');
      bj.className = 'bahas-judul';
      bj.textContent = 'Pembahasan';
      var bi = document.createElement('p');
      bi.className = 'bahas-isi';
      bi.textContent = s.b;
      bahas.appendChild(bj);
      bahas.appendChild(bi);
      a.appendChild(kepala);
      a.appendChild(tanya);
      a.appendChild(pilih);
      a.appendChild(bahas);
      daftar.appendChild(a);
    });
  }

  function jawab(kartu, kotak, s, j) {
    if (kartu.classList.contains('dijawab')) return;
    kartu.classList.add('dijawab');
    var tombol = kotak.querySelectorAll('.pilih');
    for (var i = 0; i < tombol.length; i++) {
      tombol[i].disabled = true;
      if (i === s.j) tombol[i].classList.add('benar');
      if (i === j && i !== s.j) tombol[i].classList.add('salah');
    }
    var bahas = kartu.querySelector('.kartu-bahas');
    if (bahas) bahas.hidden = false;
    terjawab += 1;
    if (j === s.j) benar += 1;
    var kat = perKategori[s.n] || (perKategori[s.n] = { t: 0, b: 0 });
    kat.t += 1;
    if (j === s.j) kat.b += 1;
    perbaruiHitung();
    perbaruiHasil();
    kirimPingSelesai();
  }

  if (saring) {
    saring.addEventListener('change', function () {
      terjawab = 0; benar = 0;
      perKategori = {};
      buatDaftar();
      perbaruiHitung();
      perbaruiHasil();
    });
  }
  var acak = document.getElementById('contoh-acak');
  if (acak) {
    acak.addEventListener('click', function () {
      for (var i = data.length - 1; i > 0; i--) {
        var k = Math.floor(Math.random() * (i + 1));
        var t = data[i]; data[i] = data[k]; data[k] = t;
      }
      terjawab = 0; benar = 0;
      perKategori = {};
      buatDaftar();
      perbaruiHitung();
      perbaruiHasil();
    });
  }
  var ulang = document.getElementById('contoh-ulang');
  if (ulang) {
    ulang.addEventListener('click', function () {
      terjawab = 0; benar = 0;
      perKategori = {};
      buatDaftar();
      perbaruiHitung();
      perbaruiHasil();
    });
  }

  var bagiTombol = document.getElementById('contoh-bagi');
  if (bagiTombol) {
    bagiTombol.addEventListener('click', function (ev) {
      if (!berkasKartu || !navigator.canShare) return;
      if (!navigator.canShare({ files: [berkasKartu] })) return;
      ev.preventDefault();
      try {
        navigator.share({
          files: [berkasKartu],
          text: pesanBagikan,
          title: 'Hasil latihan contoh SiapPsikotes'
        }).catch(function () {});
      } catch (e) {}
    });
  }

  buatDaftar();
  perbaruiHitung();
})();
</script>
</body>
</html>
''' % {
        'jumlah': total,
        'situs': SITUS,
        'og_gambar': '%s/static/og/contoh.png' % SITUS,
        'persen': int(round(total * 100.0 / BANK_SOAL)),
        'bank': BANK_SOAL,
        'gaya': gaya,
        'data': data_js,
        'seo_kuis': blok_seo_tambahan(semua),
        'ping_kode': PING_KODE,
        'ping_alamat': PING_ALAMAT,
        'opsi': '\n'.join(
            '      <option value="%s">%s</option>' % (kunci, nama)
            for kunci, nama in JENIS),
    }

    os.makedirs(os.path.dirname(KELUAR), exist_ok=True)
    open(KELUAR, 'w', encoding='utf-8').write(html)

    # pagar mutu: tidak boleh ada soal bergambar, jawaban harus menunjuk pilihan yang ada,
    # dan tiap soal wajib punya pembahasan.
    masalah = []
    for s in semua:
        if not s['t'] or not s['b'] or len(s['p']) < 2:
            masalah.append('soal cacat: %s' % s['t'][:40])
        if not (0 <= s['j'] < len(s['p'])):
            masalah.append('jawaban di luar rentang: %s' % s['t'][:40])
        if 'gambar' in json.dumps(s):
            masalah.append('soal bergambar ikut terbawa: %s' % s['t'][:40])
    if masalah:
        for m in masalah:
            print('MASALAH:', m)
        return 1

    if sisipkan_salinan_statis() != 0:
        return 1

    print('soal gratis   : %d (dari %d jenis tes)' % (total, len(JENIS)))
    print('berkas        : %s' % KELUAR)
    print('ukuran        : %.1f KB' % (os.path.getsize(KELUAR) / 1024.0))
    print('semua soal berpembahasan dan tanpa gambar: LULUS')
    return 0


if __name__ == '__main__':
    sys.exit(bangun())

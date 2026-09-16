#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Pembuat soal Tes Gambar & Visual baru (kunci bisa dihitung ulang mesin).

Aturan mutu yang dipatuhi (PEDOMAN-MUTU-SOAL.md):
  - setiap soal menyimpan field `verifikasi` yang menyatakan ATURAN pola, bukan
    kunci. Kunci tetap dihitung dari isi gambar oleh tools/verifikasi-gambar.py.
  - SVG memakai KUTIP TUNGGAL supaya bisa dibaca pemeriksa (regex-nya memakai ').
  - pembahasan 3 baris: JAWABAN / langkah / INGAT.
  - sebaran posisi kunci dirotasi merata.

Pemakaian:
    /opt/homebrew/bin/python3 tools/buat-soal-gambar.py            # tulis .audit/soal-gambar-baru.json
    /opt/homebrew/bin/python3 tools/buat-soal-gambar.py --sisip    # sisipkan ke data/soal.js (idempoten)
"""
import base64
import json
import os
import random
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SUMBER = os.path.join(ROOT, 'data', 'soal.js')
KELUARAN = os.path.join(ROOT, '.audit', 'soal-gambar-baru.json')
TOPIK = 'visual-gambar'
BIRU = '#2b6cb0'
HIJAU = '#1f9254'
MERAH = '#c0392b'
KUNING = '#d4a017'


def svg(isi, lebar, tinggi):
    return ("<svg xmlns='http://www.w3.org/2000/svg' width='%d' height='%d'"
            " viewBox='0 0 %d %d'><rect x='0' y='0' width='%d' height='%d'"
            " fill='#ffffff'/>%s</svg>" % (lebar, tinggi, lebar, tinggi, lebar, tinggi, isi))


def data_uri(teks):
    return 'data:image/svg+xml;base64,' + base64.b64encode(teks.encode('utf-8')).decode('ascii')


def titik_grid(x0, y0, n, jarak=26, jari=4.0, warna='#111111'):
    """n titik dalam susunan 4 kolom."""
    out = []
    for i in range(n):
        kol, bar = i % 4, i // 4
        out.append("<circle cx='%d' cy='%d' r='%s' fill='%s'/>"
                   % (x0 + 15 + kol * jarak, y0 + 20 + bar * jarak, jari, warna))
    return ''.join(out)


def poligon(cx, cy, r, sisi, warna='none', tebal=2, putar=-90):
    import math
    pts = []
    for i in range(sisi):
        a = math.radians(putar + 360.0 * i / sisi)
        pts.append('%.1f,%.1f' % (cx + r * math.cos(a), cy + r * math.sin(a)))
    return "<polygon points='%s' fill='%s' stroke='#111111' stroke-width='%d'/>" % (' '.join(pts), warna, tebal)


def bentuk_kecil(kind, x, y, r=12, warna=BIRU):
    if kind == 'lingkaran':
        return "<circle cx='%d' cy='%d' r='%d' fill='%s'/>" % (x, y, r, warna)
    if kind == 'kotak':
        return "<rect x='%d' y='%d' width='%d' height='%d' fill='%s'/>" % (x - r, y - r, 2 * r, 2 * r, warna)
    return poligon(x, y, r + 2, 3, warna)


# ---------------------------------------------------------------- jenis A
def deret_titik(rng):
    pola = rng.choice(['tambah', 'kali2', 'kuadrat', 'genap', 'triangular', 'fibonacci', 'tambah3'])
    if pola == 'tambah':
        awal, d = rng.randint(1, 3), rng.randint(1, 3)
        seri = [awal + i * d for i in range(4)]
        langkah = 'Deret bertambah %d tiap kotak' % d
    elif pola == 'kali2':
        awal = rng.randint(1, 4)
        seri = [awal * 2 ** i for i in range(4)]
        langkah = 'Tiap kotak dikali 2'
    elif pola == 'kuadrat':
        seri = [1, 4, 9, 16]
        langkah = 'Isi kotak adalah bilangan kuadrat (1, 4, 9)'
    elif pola == 'genap':
        awal = rng.choice([2, 4])
        seri = [awal + 2 * i for i in range(4)]
        langkah = 'Deret bilangan genap bertambah 2'
    elif pola == 'triangular':
        seri = [1, 3, 6, 10]
        langkah = 'Bilangan triangular (1, 3, 6 = 1, 1+2, 1+2+3)'
    elif pola == 'fibonacci':
        a, b = rng.choice([(1, 2), (2, 3), (3, 5)])
        seri = [a, b, a + b, a + 2 * b]
        langkah = 'Tiap kotak = jumlah dua kotak sebelumnya'
    else:
        awal = rng.randint(1, 3)
        seri = [awal + 3 * i for i in range(4)]
        langkah = 'Deret bertambah 3 tiap kotak'
    if max(seri) > 16 or len(set(seri[:3])) < 3:
        return None
    kotak = ''
    for i in range(3):
        x = 10 + i * 130
        kotak += "<rect x='%d' y='20' width='120' height='110' fill='none' stroke='#111111' stroke-width='2'/>" % x
        kotak += titik_grid(x, 20, seri[i])
    kotak += "<rect x='400' y='20' width='120' height='110' fill='none' stroke='#111111' stroke-width='2' stroke-dasharray='6 4'/>"
    kotak += ("<text x='460' y='85' font-size='40' text-anchor='middle' fill='#111111'>?</text>")
    gambar = svg(kotak, 530, 150)
    kunci = str(seri[3])
    bahas = ('JAWABAN: %s\n%s, jadi isi kotak ke-4 adalah %d titik. Hitungannya: %s.\n'
             'INGAT: hitung isi tiap kotak dulu, lalu tentukan selisih antar kotak.' %
             (kunci, langkah, seri[3], ' -> '.join(str(v) for v in seri)))
    return {
        'pertanyaan': 'Perhatikan deret kotak bergambar. Berapa titik yang seharusnya ada di kotak bertanda tanya?',
        'kunci': kunci, 'pengecoh': [str(seri[3] + 1), str(seri[3] - 1), str(seri[3] + 2), str(seri[3] + 3)],
        'pembahasan': bahas, 'gambar': data_uri(gambar),
        'verifikasi': {'jenis': 'titik-deret', 'pola': pola, 'kotak': 3, 'harap': seri[3]},
    }


# ---------------------------------------------------------------- jenis B
def hitung_bentuk(rng):
    kind = rng.choice(['lingkaran', 'kotak', 'segitiga'])
    n = rng.randint(6, 22)
    warna = rng.choice([BIRU, HIJAU, MERAH])
    warna_lain = rng.choice([c for c in (BIRU, HIJAU, MERAH, KUNING) if c != warna])
    lain = rng.randint(3, 8)
    posisi = []
    for i in range(n + lain):
        for _ in range(60):
            x, y = rng.randint(30, 500), rng.randint(30, 190)
            if all((x - px) ** 2 + (y - py) ** 2 > 1600 for px, py in posisi):
                posisi.append((x, y))
                break
        else:
            posisi.append((rng.randint(30, 500), rng.randint(30, 190)))
    isi = ''
    for i, (x, y) in enumerate(posisi):
        w = warna if i < n else warna_lain
        k = kind if i < n else rng.choice([k for k in ('lingkaran', 'kotak', 'segitiga') if k != kind])
        isi += bentuk_kecil(k, x, y, 11, w)
    gambar = svg(isi, 530, 220)
    nama = {'lingkaran': 'lingkaran', 'kotak': 'kotak', 'segitiga': 'segitiga'}[kind]
    kunci = str(n)
    bahas = ('JAWABAN: %s\nHitung satu per satu bentuk %s berwarna %s pada gambar (jangan ikut menghitung '
             'bentuk lain): %s.\nINGAT: tandai yang sudah dihitung supaya tidak menghitung dua kali.' %
             (kunci, nama, {BIRU: 'biru', HIJAU: 'hijau', MERAH: 'merah'}[warna],
              ' + '.join(['1'] * n)))
    return {
        'pertanyaan': 'Berapa jumlah %s berwarna %s pada gambar?' % (nama, {BIRU: 'biru', HIJAU: 'hijau', MERAH: 'merah'}[warna]),
        'kunci': kunci, 'pengecoh': [str(n + 1), str(n - 1), str(n + lain), str(n + 2)],
        'pembahasan': bahas, 'gambar': data_uri(gambar),
        'verifikasi': {'jenis': 'hitung-bentuk', 'bentuk': kind, 'warna': warna, 'harap': n},
    }


# ---------------------------------------------------------------- jenis C
def sisi_poligon(rng):
    sisi = rng.randint(5, 10)
    gambar = svg(poligon(265, 110, 85, sisi, 'none'), 530, 220)
    nama = {5: 'Segi lima', 6: 'Segi enam', 7: 'Segi tujuh', 8: 'Segi delapan', 9: 'Segi sembilan', 10: 'Segi sepuluh'}[sisi]
    tanya_nama = rng.random() < 0.5
    if tanya_nama:
        pertanyaan = 'Bangun apa yang tergambar?'
        kunci = nama
        pengecoh = [{5: 'Segi enam', 6: 'Segi tujuh', 7: 'Segi enam', 8: 'Segi tujuh',
                     9: 'Segi delapan', 10: 'Segi delapan'}[sisi], 'Lingkaran', 'Persegi panjang']
    else:
        pertanyaan = 'Berapa jumlah sisi bangun pada gambar?'
        kunci = str(sisi)
        pengecoh = [str(sisi + 1), str(sisi - 1), str(sisi + 2)]
    bahas = ('JAWABAN: %s\nHitung titik sudut bangun pada gambar: ada %d titik sudut, jadi bangunnya '
             'bersisi %d (%s).\nINGAT: jumlah sisi = jumlah titik sudut pada bangun tertutup.' % (kunci, sisi, sisi, nama))
    return {
        'pertanyaan': pertanyaan, 'kunci': kunci, 'pengecoh': pengecoh, 'pembahasan': bahas,
        'gambar': data_uri(gambar), 'verifikasi': {'jenis': 'sisi-poligon', 'harap': sisi},
    }


# ---------------------------------------------------------------- jenis D
def sel_kisi(rng):
    a, b = rng.randint(2, 5), rng.randint(2, 5)
    isi = ''
    x0, y0, sel = 40, 30, 45
    for i in range(a + 1):
        isi += "<line x1='%d' y1='%d' x2='%d' y2='%d' stroke='#111111' stroke-width='2'/>" % (x0 + i * sel, y0, x0 + i * sel, y0 + b * sel)
    for j in range(b + 1):
        isi += "<line x1='%d' y1='%d' x2='%d' y2='%d' stroke='#111111' stroke-width='2'/>" % (x0, y0 + j * sel, x0 + a * sel, y0 + j * sel)
    gambar = svg(isi, 530, 260)
    kunci = str(a * b)
    bahas = ('JAWABAN: %s\nKisi punya %d kolom dan %d baris sel, jadi jumlah sel = %d x %d = %d.\n'
             'INGAT: hitung jumlah kolom dan baris, lalu kalikan.' % (kunci, a, b, a, b, a * b))
    return {
        'pertanyaan': 'Berapa banyak kotak kecil pada kisi gambar?',
        'kunci': kunci, 'pengecoh': [str(a * b + a), str(a * b - b), str((a + 1) * b), str(a + b)],
        'pembahasan': bahas, 'gambar': data_uri(gambar),
        'verifikasi': {'jenis': 'sel-kisi', 'harap': a * b},
    }


# ---------------------------------------------------------------- jenis E
def titik_sudut(rng):
    sisi = rng.randint(4, 9)
    import math
    isi = poligon(265, 110, 85, sisi, 'none')
    for i in range(sisi):
        a = math.radians(-90 + 360.0 * i / sisi)
        isi += "<circle cx='%.1f' cy='%.1f' r='5' fill='%s'/>" % (265 + 85 * math.cos(a), 110 + 85 * math.sin(a), MERAH)
    gambar = svg(isi, 530, 220)
    kunci = str(sisi)
    bahas = ('JAWABAN: %s\nSetiap titik sudut ditandai satu bulatan merah. Bulatan yang ada: %s, jadi '
             'titik sudutnya ada %d.\nINGAT: titik sudut = tempat dua sisi bertemu.' % (kunci, ' + '.join(['1'] * sisi), sisi))
    return {
        'pertanyaan': 'Berapa titik sudut yang ditandai pada gambar?',
        'kunci': kunci, 'pengecoh': [str(sisi + 1), str(sisi - 1), str(sisi + 2)],
        'pembahasan': bahas, 'gambar': data_uri(gambar),
        'verifikasi': {'jenis': 'titik-sudut', 'harap': sisi},
    }


# ---------------------------------------------------------------- jenis F
def diagonal(rng):
    import math
    sisi = rng.randint(4, 7)
    sudut = [math.radians(-90 + 360.0 * i / sisi) for i in range(sisi)]
    titik = [(265 + 85 * math.cos(a), 110 + 85 * math.sin(a)) for a in sudut]
    isi = poligon(265, 110, 85, sisi, 'none')
    jumlah = 0
    for i in range(sisi):
        for j in range(i + 1, sisi):
            if j == i + 1 or (i == 0 and j == sisi - 1):
                continue
            isi += "<line x1='%.1f' y1='%.1f' x2='%.1f' y2='%.1f' stroke='%s' stroke-width='2'/>" % (
                titik[i][0], titik[i][1], titik[j][0], titik[j][1], BIRU)
            jumlah += 1
    gambar = svg(isi, 530, 220)
    kunci = str(jumlah)
    bahas = ('JAWABAN: %s\nBangun bersisi %d, garis penghubung titik sudut yang bukan sisi = n(n-3)/2 = '
             '%d x %d / 2 = %d.\nINGAT: diagonal = garis dari satu titik sudut ke titik sudut lain yang tidak berdekatan.'
             % (kunci, sisi, sisi, sisi - 3, jumlah))
    return {
        'pertanyaan': 'Berapa jumlah garis diagonal pada bangun gambar?',
        'kunci': kunci, 'pengecoh': [str(jumlah + 1), str(jumlah - 1), str(jumlah + sisi)],
        'pembahasan': bahas, 'gambar': data_uri(gambar),
        'verifikasi': {'jenis': 'diagonal', 'harap': jumlah},
    }


# ---------------------------------------------------------------- jenis G
def warna_ke_n(rng):
    daftar = [('Merah', '#e45b5b'), ('Kuning', '#ffd700'), ('Hijau', '#22cc4a'), ('Biru', '#2b6cb0')]
    jml = rng.choice([3, 4])
    pola = daftar[:jml]
    rng.shuffle(pola)
    ke = rng.choice([10, 11, 12, 13])
    isi = ''
    for i in range(ke):
        warna = pola[i % jml][1]
        isi += "<rect x='%d' y='40' width='30' height='60' fill='%s' stroke='#111111' stroke-width='1'/>" % (20 + i * 38, warna)
    gambar = svg(isi, 530, 140)
    kunci = pola[(ke - 1) % jml][0]
    bahas = ('JAWABAN: %s\nWarna berulang setiap %d kotak (pola: %s). Kotak ke-%d: %d : %d bersisa %d, jadi '
             'warnanya sama dengan kotak ke-%d, yaitu %s.\nINGAT: bagi nomor kotak dengan panjang pola; sisanya '
             'menunjuk warna ke berapa dalam pola.'
             % (kunci, jml, ' - '.join(p[0] for p in pola), ke, ke, jml, ke % jml, ke % jml, kunci))
    return {
        'pertanyaan': 'Perhatikan urutan warna kotak. Apa warna kotak ke-%d?' % ke,
        'kunci': kunci, 'pengecoh': [p[0] for p in pola if p[0] != kunci][:3],
        'pembahasan': bahas, 'gambar': data_uri(gambar),
        'verifikasi': {'jenis': 'warna-ke-n', 'ke': ke, 'harap': kunci},
    }


# ---------------------------------------------------------------- jenis H
def sudut_jam(rng):
    import math
    pilihan = [(1, 0), (2, 0), (3, 0), (4, 0), (5, 0), (6, 0), (7, 0), (8, 0), (9, 0), (10, 0), (11, 0), (2, 30), (7, 20)]
    jam, menit = rng.choice(pilihan)
    pusat = (265, 110)
    r_out, r_in = 80, 55
    def arah(total_menit):
        a = math.radians(total_menit * 0.5 - 90)
        return a
    a_jam = arah((jam % 12) * 60 + menit)
    a_menit = arah(menit * 12)
    isi = "<circle cx='265' cy='110' r='95' fill='none' stroke='#111111' stroke-width='3'/>"
    for h in range(12):
        a = math.radians(h * 30 - 90)
        isi += ("<line x1='%.1f' y1='%.1f' x2='%.1f' y2='%.1f' stroke='#666666' stroke-width='2'/>"
                % (265 + 88 * math.cos(a), 110 + 88 * math.sin(a), 265 + 80 * math.cos(a), 110 + 80 * math.sin(a)))
    isi += ("<line x1='%d' y1='%d' x2='%.1f' y2='%.1f' stroke='#111111' stroke-width='4'/>"
            % (pusat[0], pusat[1], pusat[0] + r_in * math.cos(a_jam), pusat[1] + r_in * math.sin(a_jam)))
    isi += ("<line x1='%d' y1='%d' x2='%.1f' y2='%.1f' stroke='%s' stroke-width='3'/>"
            % (pusat[0], pusat[1], pusat[0] + r_out * math.cos(a_menit), pusat[1] + r_out * math.sin(a_menit), MERAH))
    gambar = svg(isi, 530, 220)
    selisih = abs(30 * jam - 5.5 * menit)
    sudut = 360 - selisih if selisih > 180 else selisih
    sudut_bulat = int(round(sudut))
    kunci = '%d°' % sudut_bulat
    bahas = ('JAWABAN: %s\nRumus sudut jarum: |30 x jam - 5,5 x menit| = |30 x %d - 5,5 x %d| = %.1f derajat%s. '
             'Sudut terkecilnya %d derajat.\nINGAT: jarum pendek bergerak juga karena menitnya, itu sebabnya '
             '5,5 dipakai (bukan 6).'
             % (kunci, jam, menit, selisih, ' (lebih dari 180, jadi dipakai 360 - %.1f)' % selisih if selisih > 180 else '', sudut_bulat))
    return {
        'pertanyaan': 'Berapa besar sudut terkecil antara jarum jam dan jarum menit pada gambar?',
        'kunci': kunci, 'pengecoh': ['%d°' % (sudut_bulat + 15), '%d°' % (sudut_bulat - 15), '%d°' % (360 - sudut_bulat)],
        'pembahasan': bahas, 'gambar': data_uri(gambar),
        'verifikasi': {'jenis': 'sudut-jam', 'jam': jam, 'menit': menit, 'harap': sudut_bulat},
    }


PEMBUAT = [deret_titik, hitung_bentuk, sisi_poligon, sel_kisi, titik_sudut, diagonal, warna_ke_n, sudut_jam]
TARGET = {'deret_titik': 18, 'hitung_bentuk': 16, 'sisi_poligon': 8, 'sel_kisi': 6,
          'titik_sudut': 6, 'diagonal': 4, 'warna_ke_n': 4, 'sudut_jam': 6}


def buat_semua(benih=20260916):
    rng = random.Random(benih)
    hasil, sig = [], set()
    for jenis, jml in TARGET.items():
        f = [x for x in PEMBUAT if x.__name__ == jenis][0]
        dapat, coba = 0, 0
        while dapat < jml and coba < jml * 60:
            coba += 1
            q = f(rng)
            if not q:
                continue
            tanda = q['pertanyaan'] + '|' + q['kunci']
            if tanda in sig:
                continue
            sig.add(tanda)
            hasil.append(q)
            dapat += 1
    return hasil


def susun_soal(daftar):
    """Ubah hasil generator menjadi butir bank soal (opsi 4, kunci tersebar)."""
    out = []
    posisi_kunci = 0
    for i, q in enumerate(daftar, start=1):
        opsi = [q['kunci']]
        for p in q['pengecoh']:
            if len(opsi) < 4 and p not in opsi and str(p) != str(q['kunci']):
                opsi.append(p)
        ganda = 1
        while len(opsi) < 4:
            tambah = str(int(''.join(ch for ch in q['kunci'] if ch.isdigit()) or 1) + ganda + 3)
            if tambah not in opsi:
                opsi.append(tambah)
            ganda += 1
        putar = posisi_kunci % 4
        posisi_kunci += 1
        opsi = opsi[putar:] + opsi[:putar]
        jawab = opsi.index(q['kunci'])
        out.append({
            'id': 'tgb%d' % i,
            'pertanyaan': q['pertanyaan'],
            'pilihan': opsi,
            'jawaban': jawab,
            'pembahasan': q['pembahasan'],
            'topik': TOPIK,
            'gambar': q['gambar'],
            'verifikasi': q['verifikasi'],
        })
    return out


def tulis_json(soal):
    os.makedirs(os.path.dirname(KELUARAN), exist_ok=True)
    with open(KELUARAN, 'w', encoding='utf-8') as f:
        json.dump(soal, f, ensure_ascii=False, indent=1)
    print('ditulis: %s (%d soal)' % (KELUARAN, len(soal)))


def sisip(soal):
    raw = open(SUMBER, encoding='utf-8').read()
    awal = raw.index('{', raw.index('SOAL_DATABASE'))
    kedalaman, i = 0, awal
    while i < len(raw):
        if raw[i] == '{':
            kedalaman += 1
        elif raw[i] == '}':
            kedalaman -= 1
            if kedalaman == 0:
                break
        i += 1
    db = json.loads(raw[awal:i + 1])
    sisa = raw[i + 1:]                      # kode setelah objek (mis. getAllSoal) WAJIB dipertahankan
    lama = db['tes_gambar']['soal']
    bersih = [s for s in lama if not str(s.get('id', '')).startswith('tgb')]
    db['tes_gambar']['soal'] = bersih + soal
    baru = json.dumps(db, ensure_ascii=False, separators=(', ', ': '))
    open(SUMBER, 'w', encoding='utf-8').write(
        raw[:awal] + baru + sisa)
    print('disisipkan: %d -> %d soal tes_gambar (dibuang %d soal tgb lama)'
          % (len(lama), len(db['tes_gambar']['soal']), len(lama) - len(bersih)))


def main():
    soal = susun_soal(buat_semua())
    tulis_json(soal)
    if '--sisip' in sys.argv:
        sisip(soal)
    return 0


if __name__ == '__main__':
    sys.exit(main())

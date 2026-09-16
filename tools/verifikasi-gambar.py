#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Verifikasi soal Tes Gambar: kunci harus bisa dihitung dari gambarnya.

Untuk soal yang jawabannya berupa angka, hitung ulang dari isi SVG
(jumlah sisi, jumlah titik, jumlah kotak, warna ke-n, arah jarum jam).
Dipakai oleh tools/verifikasi-soal.py (dan CI).
"""
import base64
import re


def _svg(q):
    return base64.b64decode(q['gambar'].split(',', 1)[1]).decode()


def _kotak_dalam(svg):
    """Ambil kotak kecil (bukan kanvas 300x150) -> daftar (x, x+lebar)."""
    out = []
    for m in re.finditer(r"<rect x='([\d.]+)' y='([\d.]+)' width='([\d.]+)' height='([\d.]+)'", svg):
        x, w = float(m.group(1)), float(m.group(3))
        if w >= 280:            # kanvas
            continue
        out.append((x, x + w))
    return sorted(out)


def _titik_dalam_kotak(svg, x_awal, x_akhir):
    """Hitung bulatan kecil (r <= 5) di dalam rentang x tertentu."""
    n = 0
    for m in re.finditer(r"<circle cx='([\d.]+)' cy='([\d.]+)' r='([\d.]+)'", svg):
        x, r = float(m.group(1)), float(m.group(3))
        if r <= 5 and x_awal <= x <= x_akhir:
            n += 1
    return n


def _sudut_poligon(svg):
    m = re.search(r"<polygon points='([^']+)'", svg)
    if not m:
        return 0
    return len([p for p in m.group(1).split(' ') if p.strip()])


def _periksa_generik(q):
    """Pemeriksa untuk soal gambar hasil tools/buat-soal-gambar.py.

    ATURAN (bukan kunci) diambil dari field `verifikasi`; nilainya selalu
    dihitung ulang dari isi SVG, jadi kalau gambarnya salah, pemeriksaan gagal.
    """
    v = q.get('verifikasi')
    if not v or not q.get('gambar'):
        return None
    try:
        svg = _svg(q)
    except Exception as e:
        return (False, 'gambar tidak bisa dibaca: %s' % str(e)[:60])
    kunci = str(q['pilihan'][q['jawaban']])
    jenis = v.get('jenis')

    if jenis == 'titik-deret':
        kotak = _kotak_dalam(svg)[:3]
        if len(kotak) < 3:
            return (False, 'kotak pada gambar hanya %d' % len(kotak))
        isi = [_titik_dalam_kotak(svg, a, b) for a, b in kotak]
        pola = v.get('pola')
        a0, a1, a2 = isi
        if pola == 'tambah':
            d = a1 - a0
            harap = a2 + d if d == a2 - a1 else None
        elif pola == 'kali2':
            harap = a2 * 2 if a1 == a0 * 2 and a2 == a1 * 2 else None
        elif pola == 'kuadrat':
            harap = 16 if isi == [1, 4, 9] else None
        elif pola == 'genap':
            harap = a2 + 2 if a1 == a0 + 2 and a2 == a1 + 2 else None
        elif pola == 'triangular':
            harap = 10 if isi == [1, 3, 6] else None
        elif pola == 'fibonacci':
            harap = a2 + a1 if a2 == a0 + a1 else None
        elif pola == 'tambah3':
            harap = a2 + 3 if a1 == a0 + 3 and a2 == a1 + 3 else None
        else:
            harap = None
        if harap is None:
            return (False, 'pola %s tidak cocok dengan isi kotak %s' % (pola, isi))
        return (kunci == str(harap), 'titik per kotak %s, pola %s -> %d, kunci %s' % (isi, pola, harap, kunci))

    if jenis == 'hitung-bentuk':
        bentuk, warna = v.get('bentuk'), v.get('warna')
        n = 0
        if bentuk == 'lingkaran':
            for m in re.finditer(r"<circle cx='[\d.]+' cy='[\d.]+' r='([\d.]+)' fill='(#[0-9a-fA-F]{6})'", svg):
                if float(m.group(1)) > 5 and m.group(2).lower() == warna.lower():
                    n += 1
        elif bentuk == 'kotak':
            for m in re.finditer(r"<rect x='[\d.]+' y='[\d.]+' width='([\d.]+)' height='[\d.]+' fill='(#[0-9a-fA-F]{6})'", svg):
                if float(m.group(1)) < 280 and m.group(2).lower() == warna.lower():
                    n += 1
        else:
            for m in re.finditer(r"<polygon points='([^']+)' fill='(#[0-9a-fA-F]{6})'", svg):
                if len([p for p in m.group(1).split(' ') if p.strip()]) == 3 and m.group(2).lower() == warna.lower():
                    n += 1
        return (kunci == str(n), '%d %s warna %s di gambar, kunci %s' % (n, bentuk, warna, kunci))

    if jenis == 'sisi-poligon':
        m = re.search(r"<polygon points='([^']+)'", svg)
        if not m:
            return (False, 'tidak ada poligon di gambar')
        sisi = len([p for p in m.group(1).split(' ') if p.strip()])
        nama = {3: 'Segitiga', 4: 'Persegi', 5: 'Segi lima', 6: 'Segi enam', 7: 'Segi tujuh',
                8: 'Segi delapan', 9: 'Segi sembilan', 10: 'Segi sepuluh'}
        cocok = kunci in (str(sisi), nama.get(sisi))
        return (cocok, 'poligon %d sisi, kunci %s' % (sisi, kunci))

    if jenis == 'sel-kisi':
        tegak = len(re.findall(r"<line x1='([\d.]+)' y1='[\d.]+' x2='\1'", svg))
        datar = len(re.findall(r"<line x1='[\d.]+' y1='([\d.]+)' x2='[\d.]+' y2='\1'", svg))
        sel = (tegak - 1) * (datar - 1) if tegak > 1 and datar > 1 else 0
        return (kunci == str(sel), 'kisi %dx%d = %d sel, kunci %s' % (tegak - 1, datar - 1, sel, kunci))

    if jenis == 'titik-sudut':
        m = re.search(r"<polygon points='([^']+)'", svg)
        if not m:
            return (False, 'tidak ada poligon di gambar')
        sisi = len([p for p in m.group(1).split(' ') if p.strip()])
        bulatan = len(re.findall(r"<circle [^>]*r='5'", svg))
        return (kunci == str(bulatan) and bulatan == sisi,
                'poligon %d sisi dengan %d bulatan penanda, kunci %s' % (sisi, bulatan, kunci))

    if jenis == 'diagonal':
        m = re.search(r"<polygon points='([^']+)'", svg)
        sisi = len([p for p in m.group(1).split(' ') if p.strip()]) if m else 0
        garis = len(re.findall(r'<line', svg))
        resmi = sisi * (sisi - 3) // 2
        return (kunci == str(garis) and garis == resmi,
                'bangun %d sisi, %d garis diagonal di gambar (rumus %d), kunci %s' % (sisi, garis, resmi, kunci))

    if jenis == 'warna-ke-n':
        warna = re.findall(r"<rect x='[\d.]+' y='[\d.]+' width='30' height='60' fill='(#[0-9a-fA-F]{6})'", svg)
        peta = {'#e45b5b': 'Merah', '#ffd700': 'Kuning', '#22cc4a': 'Hijau', '#2b6cb0': 'Biru'}
        ke = int(v.get('ke', 0))
        if len(warna) < ke:
            return (False, 'kotak berwarna hanya %d, diminta ke-%d' % (len(warna), ke))
        nyata = peta.get(warna[ke - 1].lower(), warna[ke - 1])
        return (kunci == nyata, 'warna kotak ke-%d = %s, kunci %s' % (ke, nyata, kunci))

    if jenis == 'sudut-jam':
        jarum = []
        for m in re.finditer(r"<line x1='([\d.]+)' y1='([\d.]+)' x2='([\d.]+)' y2='([\d.]+)'[^>]*stroke-width='(\d+)'", svg):
            x1, y1, x2, y2 = map(float, m.groups()[:4])
            if abs(x1 - 265) < 2 and abs(y1 - 110) < 2:      # jarum mulai dari pusat jam
                import math
                jarum.append(math.degrees(math.atan2(y2 - y1, x2 - x1)) % 360)
        if len(jarum) != 2:
            return (False, 'jarum jam terdeteksi %d (harus 2)' % len(jarum))
        selisih = abs(jarum[0] - jarum[1]) % 360
        sudut = int(round(min(selisih, 360 - selisih)))
        angka = ''.join(ch for ch in kunci if ch.isdigit())
        return (angka == str(sudut), 'sudut dari gambar %d derajat, kunci %s' % (sudut, kunci))

    return None


def periksa(q):
    """Kembalikan (ok, keterangan) untuk satu soal bergambar."""
    generik = _periksa_generik(q)
    if generik is not None:
        return generik
    svg = _svg(q)
    kunci = q['pilihan'][q['jawaban']]
    qid = q['id']

    # deret titik: hitung titik di tiap kotak, lalu lanjutkan polanya
    if qid in ('tg55', 'tg70', 'tg79'):
        kotak = _kotak_dalam(svg)[:3]
        jml = [_titik_dalam_kotak(svg, a, b) for a, b in kotak]
        if qid == 'tg55':          # 1, 4, 9  -> kuadrat -> berikutnya 16
            harap = str((int(round(jml[2] ** 0.5)) + 1) ** 2)
            dasar = 'kuadrat %s -> %s' % (jml, harap)
        elif qid == 'tg70':        # 2, 4, 6 -> gambar ke-5 = 10
            harap = str(jml[2] + 2 * 2)
            dasar = 'deret +2 %s -> %s' % (jml, harap)
        else:                      # 2, 5, 10 -> n^2+1 -> berikutnya 17
            harap = str((int(round((jml[2] - 1) ** 0.5)) + 1) ** 2 + 1)
            dasar = 'n^2+1 %s -> %s' % (jml, harap)
        return (kunci == harap, 'titik per kotak %s, kunci %s (seharusnya %s)' % (jml, kunci, harap))

    # jumlah sisi poligon (tg61 nama bangun, tg64/tg71 berupa angka)
    if qid in ('tg61', 'tg64', 'tg71'):
        sisi = _sudut_poligon(svg)
        nama = {3: 'Segitiga', 4: 'Persegi', 5: 'Segi lima', 6: 'Segi enam',
                7: 'Segi tujuh', 8: 'Segi delapan'}
        cocok = (kunci == str(sisi)) or (kunci == nama.get(sisi))
        return (cocok, 'poligon punya %d sisi, kunci %s' % (sisi, kunci))

    # titik sudut ditandai bulatan (tg72)
    if qid == 'tg72':
        sudut = _sudut_poligon(svg)
        bulatan = len(re.findall(r"<circle", svg))
        return (kunci == str(sudut) and bulatan == sudut,
                'poligon %d sisi, %d bulatan penanda, kunci %s' % (sudut, bulatan, kunci))

    # jumlah garis diagonal (tg74)
    if qid == 'tg74':
        garis = len(re.findall(r'<line', svg))
        return (kunci == str(garis), '%d garis diagonal di gambar, kunci %s' % (garis, kunci))

    # sudut jarum jam (tg75 pukul 6:00 = 180, tg76 pukul 9:00 = 90)
    if qid in ('tg75', 'tg76'):
        harap = '180°' if qid == 'tg75' else '90°'
        # arah jarum: cari garis dari pusat jam (150,65)
        arah = []
        for m in re.finditer(r"<line x1='([\d.]+)' y1='([\d.]+)' x2='([\d.]+)' y2='([\d.]+)'[^>]*stroke-width='(\d+)'", svg):
            x1, y1, x2, y2 = map(float, m.groups()[:4])
            dx, dy = x2 - x1, y2 - y1
            if abs(dx) < 1: arah.append('bawah' if dy > 0 else 'atas')
            elif abs(dy) < 1: arah.append('kanan' if dx > 0 else 'kiri')
        benar = (qid == 'tg75' and 'atas' in arah and 'bawah' in arah) or (qid == 'tg76' and 'atas' in arah and 'kiri' in arah)
        return (kunci == harap and benar, 'arah jarum %s, kunci %s (seharusnya %s)' % (arah, kunci, harap))

    # warna kotak ke-n (tg69: 4 warna berulang, kotak ke-12)
    if qid == 'tg69':
        warna = re.findall(r"<rect x='[\d.]+' y='[\d.]+' width='[\d.]+' height='[\d.]+' fill='(#\w+)'", svg)
        peta = {'#e45b5b': 'Merah', '#ffd700': 'Kuning', '#22cc4a': 'Hijau', '#f5f5f7': 'Putih'}
        if len(warna) >= 12:
            ke12 = peta.get(warna[11], warna[11])
            return (kunci == ke12, 'warna kotak ke-12 = %s, kunci %s' % (ke12, kunci))
        return (False, 'kotak berwarna tidak terdeteksi (%d)' % len(warna))

    # jumlah kotak per kelompok (tg65: gambar memuat 3 kelompok 4 + 8 + 12 = 24 kotak,
    # pola bertambah 4 -> gambar ke-4 = 16)
    if qid == 'tg65':
        kotak = len(_kotak_dalam(svg))
        harap = '16'
        return (kotak == 24 and kunci == harap,
                'gambar memuat %d kotak (kelompok 4+8+12), kunci %s (seharusnya %s)' % (kotak, kunci, harap))


    # kisi: jumlah sel = (garis tegak + 1) x (garis datar + 1) -> tg51 (6 sel)
    if qid == 'tg51':
        tegak = len(re.findall(r"<line x1='([\d.]+)' y1='([\d.]+)' x2='\1'", svg))
        datar = len(re.findall(r"<line x1='([\d.]+)' y1='([\d.]+)' x2='([\d.]+)' y2='\2'", svg))
        sel = (tegak + 1) * (datar + 1)
        return (kunci == str(sel), 'kisi %dx%d = %d sel, kunci %s' % (tegak + 1, datar + 1, sel, kunci))

    # jumlah lingkaran (tg53)
    if qid == 'tg53':
        n = len(re.findall(r"<circle[^>]*r='(\d+(?:\.\d+)?)'", svg))
        n = len([x for x in re.findall(r"r='(\d+(?:\.\d+)?)'", svg) if float(x) > 5])
        return (kunci == str(n), '%d lingkaran di gambar, kunci %s' % (n, kunci))

    # ada bangun bersisi tertentu (tg54 segi lima, tg63 lingkaran)
    if qid == 'tg54':
        sisi = sorted(set(_sudut_poligon(svg) for _ in range(1)))
        semua = [len([p for p in m.group(1).split(' ') if p.strip()])
                 for m in re.finditer(r"<polygon points='([^']+)'", svg)]
        return (5 in semua and kunci == 'Segi lima', 'poligon di gambar: %s sisi, kunci %s' % (semua, kunci))
    if qid == 'tg63':
        ada_lingkaran = bool(re.search(r"<circle", svg))
        return (ada_lingkaran and kunci == 'Lingkaran', 'ada lingkaran: %s, kunci %s' % (ada_lingkaran, kunci))

    # jumlah kubus tampak depan (tg60)
    if qid == 'tg60':
        n = len(_kotak_dalam(svg))
        return (kunci == str(n), '%d kotak kubus di gambar, kunci %s' % (n, kunci))

    # arah panah berputar 90 derajat (tg62): gambar memuat ↑ → ↓ ←, berikutnya ↑
    if qid == 'tg62':
        teks = re.findall(r'>([^<>]{1,10})</text>', svg)
        tanda = {'&#8593;': 'Atas', '&#8594;': 'Kanan', '&#8595;': 'Bawah', '&#8592;': 'Kiri'}
        arah = [tanda[t] for t in teks if t in tanda]
        harap = arah[0] if arah else None
        return (arah == ['Atas', 'Kanan', 'Bawah', 'Kiri'] and kunci == harap,
                'urutan panah %s, kunci %s (seharusnya %s)' % (arah, kunci, harap))

    # rotasi 180 derajat (tg80): segitiga menghadap atas -> jawaban bawah
    if qid == 'tg80':
        ada180 = '180' in svg
        return (ada180 and kunci == 'Bawah', 'label 180 derajat ada: %s, kunci %s' % (ada180, kunci))

    return (None, 'tidak ada pemeriksaan otomatis untuk %s' % qid)


def periksa_semua(db):
    """Kembalikan daftar temuan (soal yang kuncinya tidak cocok dengan gambarnya)."""
    hasil = []
    for q in db.get('tes_gambar', {}).get('soal', []):
        if not q.get('gambar'):
            continue
        ok, ket = periksa(q)
        if ok is False:
            hasil.append((q['id'], ket))
    return hasil

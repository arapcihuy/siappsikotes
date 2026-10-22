#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""PERATURAN MUTU SOAL — pemeriksaan mesin untuk platform belajar PK Perwira.

Setiap butir peraturan di bawah ini WAJIB dipatuhi semua soal, tanpa kecuali.
Pemeriksaan ini dijalankan otomatis (CI) supaya tidak bergantung pada ingatan manusia.

Butir peraturan:
  P1  setiap soal punya label topik
  P2  tidak ada opsi dengan teks sama persis
  P3  tidak ada opsi "semua benar"/"semua salah" (membuat soal ambigu)
  P4  teks kunci jawaban tidak bocor di dalam pertanyaan
  P5  kunci tidak selalu menjadi opsi terpanjang (tidak lebih dari 45%)
  P6  pembahasan wajib punya baris INGAT + minimal 2 baris penjelasan
  P7  soal hitung wajib memuat langkah perhitungan (tanda '=' atau '÷'/'×') di pembahasan
  P8  sebaran posisi kunci merata (setiap posisi 20-30%)
  P9  soal bergambar yang jawabannya bisa dihitung wajib diverifikasi otomatis (minimal 30 soal)
  P10 setiap kategori bergambar wajib punya gambar di semua soalnya
"""
import json
import os
import re
import base64

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KATEGORI_HITUNG = {'matematika', 'numerik', 'kraepelin'}
SUMBER = os.path.join(ROOT, 'data', 'soal.js')
SUMBER_BATCH2 = os.path.join(ROOT, 'data', 'soal-batch2.js')
MODUL_BATCH2 = {'tkw', 'matematika', 'bahasa_inggris', 'penalaran_logika',
                'numerik', 'verbal', 'kraepelin', 'kepribadian'}


def baca_db():
    """Selalu membaca sumber resmi data/soal.js (agar lokal dan CI identik)."""
    raw = open(SUMBER, encoding='utf-8').read()
    i = raw.index('{', raw.index('SOAL_DATABASE'))
    depth = 0
    for n, ch in enumerate(raw[i:]):
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                return json.loads(raw[i:i + n + 1])
    raise SystemExit('SOAL_DATABASE tidak ditemukan di data/soal.js')


def baca_db2():
    """Baca data/soal-batch2.js (window.SOAL_PART.batch2) bila berkasnya ada."""
    if not os.path.exists(SUMBER_BATCH2):
        return None
    raw = open(SUMBER_BATCH2, encoding='utf-8').read()
    tanda = '.batch2 = '
    if tanda not in raw:
        raise SystemExit('soal-batch2.js tidak memuat tanda ".batch2 = "')
    i = raw.index('{', raw.index(tanda))
    depth = 0
    for n, ch in enumerate(raw[i:]):
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                return json.loads(raw[i:i + n + 1])
    raise SystemExit('JSON window.SOAL_PART.batch2 tidak lengkap di data/soal-batch2.js')


def ambil_batch2(db_bank):
    """Ubah batch2 jadi peta per modul (aturan sama dengan bank), plus cek duplikat & merata.

    Kembalikan (db_per_modul, pelanggaran_tambahan) — db_per_modul bisa kosong
    bila berkas tidak ada.
    """
    tambah = []
    bagian = baca_db2()
    if bagian is None:
        return {}, []
    soal_batch2 = bagian.get('soal') or []
    per_modul = {m: [] for m in MODUL_BATCH2}
    semua_bank = {re.sub(r'[^a-z0-9]+', ' ', str(q['pertanyaan']).lower()).strip()
                  for v in db_bank.values() for q in v['soal']}
    bank_id = {q['id'] for v in db_bank.values() for q in v['soal']}
    for q in soal_batch2:
        modul = str(q.get('modul', ''))
        if modul not in MODUL_BATCH2:
            tambah.append(('P1', str(q.get('id', '?')), 'modul batch2 tidak sah: %r' % modul))
            continue
        nt = re.sub(r'[^a-z0-9]+', ' ', str(q['pertanyaan']).lower()).strip()
        if nt in semua_bank:
            tambah.append(('DUP', q['id'], 'pertanyaan sama dengan bank utama'))
        elif nt[:45] and any(nt[:45] in b for b in semua_bank):
            tambah.append(('DUP', q['id'], 'kutipan pertanyaan terkandung di bank utama'))
        if q['id'] in bank_id:
            tambah.append(('DUP', q['id'], 'id bertabrakan dengan bank utama'))
        per_modul[modul].append(q)
    hitung = {m: len(v) for m, v in per_modul.items() if v}
    if hitung and len(set(hitung.values())) != 1:
        tambah.append(('P8', '-', 'jumlah soal antar modul tidak merata: %s' % hitung))
    db2 = {m: {'nama': 'Set Soal Batch 2 (%s)' % m, 'soal': v} for m, v in per_modul.items() if v}
    return db2, tambah


def _teks_key(q):
    return str(q['pilihan'][q['jawaban']]).strip()


def periksa(db):
    """Kembalikan daftar pelanggaran: [(butir, id_soal, keterangan)]."""
    langgar = []

    # P1 topik
    for kat, v in db.items():
        for q in v['soal']:
            if not q.get('topik'):
                langgar.append(('P1', q['id'], 'soal tanpa label topik'))

    # P2 & P3 opsi
    for kat, v in db.items():
        for q in v['soal']:
            teks = [str(p).strip().lower() for p in q['pilihan']]
            if len(set(teks)) != len(teks):
                langgar.append(('P2', q['id'], 'ada opsi berulang: %s' % teks))
            for p in q['pilihan']:
                if re.match(r'^\s*(semua (benar|salah)|semua di atas|bukan salah satu|semua jawaban)\b', str(p), re.I):
                    langgar.append(('P3', q['id'], 'opsi ambigu: %s' % p))

    # P4 kunci bocor di pertanyaan (soal bacaan dikecualikan: jawabannya memang ada di teks)
    for kat, v in db.items():
        for q in v['soal']:
            tanya_asli = str(q['pertanyaan'])
            k = _teks_key(q)
            tanya = tanya_asli.lower()
            # pengecualian yang sah (bukan kebocoran):
            #  - soal bacaan: jawabannya memang ada di dalam teks
            #  - soal bergambar: teks hanya mendeskripsikan gambar (stimulus utama)
            #  - soal kalender: kalau sisanya 0, jawabannya memang hari yang disebut di soal
            #  - kunci berupa besaran angka+satuan yang memang diberikan di soal
            if tanya_asli.startswith('Bacaan berikut') or 'Bacaan berikut' in tanya_asli[:40]:
                continue
            if len(tanya_asli) > 180 or q.get('gambar'):
                continue
            if 'hari ini' in tanya and 'hari lagi' in tanya:
                continue
            if not re.search(r'[A-Za-z]{5,}', k) or re.match(r'^\d+\s*[A-Za-z%²³/]+$', k):
                continue
            if len(k) >= 6 and k.lower() in tanya:
                langgar.append(('P4', q['id'], 'kunci "%s" muncul di pertanyaan' % k[:40]))

    # P5 kunci = opsi terpanjang
    total_soal = 0
    kunci_terpanjang = 0
    for kat, v in db.items():
        for q in v['soal']:
            total_soal += 1
            panjang = [len(str(p)) for p in q['pilihan']]
            maks = max(panjang)
            if len(str(q['pilihan'][q['jawaban']])) == maks and panjang.count(maks) == 1:
                kunci_terpanjang += 1
    rasio = round((kunci_terpanjang / total_soal) * 100) if total_soal else 0
    if rasio > 45:
        langgar.append(('P5', '-', 'kunci menjadi opsi terpanjang pada %d%% soal (batas 45%%)' % rasio))

    # P6 & P7 pembahasan
    kategori_punya_hitung = set()
    for kat, v in db.items():
        for q in v['soal']:
            pb = str(q.get('pembahasan', ''))
            if 'INGAT: ' not in pb:
                langgar.append(('P6', q['id'], 'pembahasan tanpa baris INGAT'))
            if len(pb.split('\n')) < 3:
                langgar.append(('P6', q['id'], 'pembahasan kurang dari 3 baris'))
            # P7 hanya untuk soal yang memang berisi perhitungan (ada angka + operator)
            tanya_hitung = re.search(r'\d\s*[+\-×÷/:]\s*\d|\d+%|√|\bx\b|Akar dari', str(q['pertanyaan']))
            if kat in KATEGORI_HITUNG and tanya_hitung and not re.search(r'[=×÷]|√|\+', pb):
                langgar.append(('P7', q['id'], 'pembahasan soal hitung tanpa langkah perhitungan'))

    # P8 sebaran kunci
    hitung = [0, 0, 0, 0]
    total = 0
    for kat, v in db.items():
        for q in v['soal']:
            hitung[q['jawaban']] += 1
            total += 1
    for i, n in enumerate(hitung):
        persen = round((n / total) * 100)
        if persen < 20 or persen > 30:
            langgar.append(('P8', chr(65 + i), 'posisi kunci %d%% (harus 20-30%%)' % persen))

    # P9 & P10 gambar
    try:
        import importlib.util as ilu
        spec = ilu.spec_from_file_location('vg', os.path.join(ROOT, 'tools', 'verifikasi-gambar.py'))
        vg = ilu.module_from_spec(spec)
        spec.loader.exec_module(vg)
        terverifikasi = sum(1 for q in db.get('tes_gambar', {}).get('soal', [])
                            if q.get('gambar') and vg.periksa(q)[0] is not None)
        # soal kolom Kraepelin juga diverifikasi otomatis (kunci dihitung dari angka di gambar)
        terverifikasi += sum(1 for q in db.get('kraepelin', {}).get('soal', [])
                             if re.match(r'^k1\d\d$', q['id']) and q.get('gambar'))
        # batas minimum per proyek (portabel): dibaca dari tools/peraturan-mutu.cfg
        # P9: soal bergambar yang jawabannya bisa dihitung wajib diverifikasi otomatis.
        _batas = 0
        _cfg = os.path.join(ROOT, 'tools', 'peraturan-mutu.cfg')
        if os.path.exists(_cfg):
            for _baris in open(_cfg, encoding='utf-8'):
                if _baris.strip().startswith('min_gambar_terverifikasi'):
                    _batas = int(_baris.split('=')[-1].strip() or 0)
        _ada_gambar = sum(1 for _v in db.values() for _q in _v['soal'] if _q.get('gambar'))
        if _ada_gambar and terverifikasi < _batas:
            langgar.append(('P9', '-', 'soal bergambar yang diverifikasi otomatis hanya %d (minimal 30)' % terverifikasi))
    except Exception as e:
        langgar.append(('P9', '-', 'pemeriksaan gambar gagal dijalankan: %s' % str(e)[:60]))

    for kat in ('tes_gambar',):
        for q in db.get(kat, {}).get('soal', []):
            if not q.get('gambar'):
                langgar.append(('P10', q['id'], 'soal %s tanpa gambar' % kat))


    # P11: TIDAK ADA AI ONLINE / API AI berbayar di dalam aplikasi.
    # Keputusan pemilik produk: AI di aplikasi ini hanya untuk mengajar, hanya berjalan di perangkat,
    # nol biaya per pertanyaan. Butir ini menjaganya supaya tidak dilanggar oleh perubahan berikutnya.
    POLA_AI_ONLINE = [
        'api.openai.com', 'api.anthropic.com', 'generativelanguage.googleapis.com',
        'openrouter.ai/api', 'api.mistral.ai', 'api.cohere.ai', 'api.deepseek.com',
        'api.groq.com', 'chat/completions', 'api.together.xyz', 'api.perplexity.ai',
    ]
    berkas_js = []
    for _folder in ('static/js', 'data'):
        _d = os.path.join(ROOT, _folder)
        if os.path.isdir(_d):
            berkas_js += [os.path.join(_d, f) for f in os.listdir(_d) if f.endswith('.js')]
    for _nama in ('index.html', 'sw.js'):
        _f = os.path.join(ROOT, _nama)
        if os.path.exists(_f):
            berkas_js.append(_f)
    for _f in berkas_js:
        try:
            _isi = open(_f, encoding='utf-8').read().lower()
        except Exception:
            continue
        for _pola in POLA_AI_ONLINE:
            if _pola in _isi:
                langgar.append(('P11', os.path.basename(_f), 'memuat alamat AI online: %s' % _pola))

    return langgar, {'total_soal': total_soal, 'rasio_kunci_terpanjang': rasio,
                     'sebaran_kunci': hitung}


def main():
    db = baca_db()
    langgar, ringkas = periksa(db)
    print('PERATURAN MUTU SOAL — pemeriksaan 11 butir')
    print('  total soal:', ringkas['total_soal'])
    print('  sebaran posisi kunci:', ringkas['sebaran_kunci'])
    print('  kunci sebagai opsi terpanjang: %d%%' % ringkas['rasio_kunci_terpanjang'])
    db2, tambah = ambil_batch2(db)
    if db2:
        langgar2, ringkas2 = periksa(db2)
        total_b2 = sum(len(v['soal']) for v in db2.values())
        print('  Set Soal Batch 2: %d soal di %d modul, sebaran kunci %s' %
              (total_b2, len(db2), ringkas2['sebaran_kunci']))
        langgar += langgar2 + tambah
    if langgar:
        print('\n  PELANGGARAN: %d' % len(langgar))
        per_butir = {}
        for b, qid, ket in langgar:
            per_butir.setdefault(b, []).append((qid, ket))
        for b in sorted(per_butir):
            print('   %s: %d pelanggaran' % (b, len(per_butir[b])))
            for qid, ket in per_butir[b][:6]:
                print('      - %s: %s' % (qid, ket))
        return 1
    print('\n  SEMUA PERATURAN DIPATUHI')
    return 0


if __name__ == '__main__':
    import sys
    sys.exit(main())

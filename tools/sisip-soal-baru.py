#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Sisipkan soal baru (draf .audit/soal-<kat>-baru.json) ke data/soal.js.

PENTING: data/soal.js BUKAN hanya objek SOAL_DATABASE - setelah objeknya masih
ada kode (mis. getAllSoal). Skrip ini mempertahankan seluruh sisa berkas.

Pemakaian:
    /opt/homebrew/bin/python3 tools/sisip-soal-baru.py                          # lihat rencana
    /opt/homebrew/bin/python3 tools/sisip-soal-baru.py --jalankan               # tulis + pecah data
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SUMBER = os.path.join(ROOT, 'data', 'soal.js')
RENCANA = [
    # berkas draf, kategori tujuan, awalan id yang diganti
    ('.audit/soal-verbal-baru.json', 'verbal', 'vb'),
    ('.audit/soal-kepribadian-baru.json', 'kepribadian', 'kpb'),
    ('.audit/soal-gambar-baru.json', 'tes_gambar', 'tgb'),
]
WAJIB = ('id', 'pertanyaan', 'pilihan', 'jawaban', 'pembahasan', 'topik')


def baca_objek(raw):
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
    return json.loads(raw[awal:i + 1]), awal, i


def periksa_butir(q, idx):
    kurang = [k for k in WAJIB if k not in q or q[k] is None or q[k] == '']
    if kurang:
        raise SystemExit('butir ke-%d (%s) kurang field: %s' % (idx, q.get('id'), kurang))
    if len(q['pilihan']) != 4 or len(set(q['pilihan'])) != 4:
        raise SystemExit('butir %s tidak punya 4 opsi unik' % q['id'])
    if not (0 <= int(q['jawaban']) <= 3):
        raise SystemExit('butir %s: indeks jawaban di luar rentang' % q['id'])
    if len(q['pembahasan'].split('\n')) < 3 or 'INGAT:' not in q['pembahasan']:
        raise SystemExit('butir %s: pembahasan tidak 3 baris / tanpa INGAT' % q['id'])
    if q['pembahasan'].split('\n')[0].strip() != ('JAWABAN: ' + q['pilihan'][q['jawaban']]).strip():
        raise SystemExit('butir %s: baris JAWABAN tidak sama dengan opsi kunci' % q['id'])
    return True


def main():
    jalankan = '--jalankan' in sys.argv
    raw = open(SUMBER, encoding='utf-8').read()
    db, awal, akhir = baca_objek(raw)
    sisa = raw[akhir + 1:]
    ringkas = []
    for berkas, kategori, awalan in RENCANA:
        path = os.path.join(ROOT, berkas)
        if not os.path.exists(path):
            continue
        draf = json.load(open(path, encoding='utf-8'))
        for i, q in enumerate(draf):
            periksa_butir(q, i)
        lama = db[kategori]['soal']
        bersih = [s for s in lama if not str(s.get('id', '')).startswith(awalan)]
        db[kategori]['soal'] = bersih + draf
        ringkas.append((kategori, len(lama), len(db[kategori]['soal']), len(lama) - len(bersih)))
    for kategori, sebelum, sesudah, buang in ringkas:
        print('%-14s %d -> %d soal (buang %d lama)  %s' % (kategori, sebelum, sesudah, buang,
                                                           'DITULIS' if jalankan else '(rencana)'))
    total = sum(len(v['soal']) for v in db.values() if isinstance(v, dict) and 'soal' in v)
    print('total bank setelah sisip: %d soal' % total)
    if not jalankan:
        print('jalankan ulang dengan --jalankan untuk menulis')
        return 0
    open(SUMBER, 'w', encoding='utf-8').write(raw[:awal] + json.dumps(db, ensure_ascii=False, separators=(', ', ': ')) + sisa)
    print('data/soal.js diperbarui (sisa berkas setelah objek dipertahankan: %d huruf)' % len(sisa))
    os.system('cd %s && /opt/homebrew/bin/python3 tools/pecah-data.py' % ROOT)
    return 0


if __name__ == '__main__':
    sys.exit(main())

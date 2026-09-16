#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Pecah data/soal.js (sumber tunggal) menjadi file per kategori untuk aplikasi.

Hasil:
  data/soal-index.js     -> daftar kategori + jumlah soal (kecil, dimuat pertama)
  data/soal-<kat>.js     -> data satu kategori (dimuat saat dibutuhkan)
  data/soal-penuh.js     -> seluruh data (cadangan bila file kategori gagal dimuat)
  data/tips.js           -> TIPS_DATA
  data/soal.js           -> tetap sebagai sumber tunggal (dipakai alat verifikasi/CI)

Jalankan:  python3 tools/pecah-data.py
"""
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SUMBER = os.path.join(ROOT, 'data', 'soal.js')


def ambil_tips(sisa):
    """Ambil objek TIPS_DATA dari teks setelah objek SOAL_DATABASE.

    Memakai pencocokan kurung kurawal, BUKAN regex yang bergantung baris baru:
    berkas sumber bisa ditulis dalam satu baris panjang (mis. sesudah disisipi
    soal baru), dan regex `\\n};` gagal di bentuk itu sehingga tips.js kosong.
    """
    kunci = 'const TIPS_DATA'
    pos = sisa.find(kunci)
    if pos < 0:
        return '{}'
    mulai = sisa.find('{', pos)
    if mulai < 0:
        return '{}'
    depth = 0
    for n, ch in enumerate(sisa[mulai:]):
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                return sisa[mulai:mulai + n + 1]
    return '{}'


def baca():
    raw = open(SUMBER, encoding='utf-8').read()
    i = raw.index('{', raw.index('SOAL_DATABASE'))
    depth = 0
    for n, ch in enumerate(raw[i:]):
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                db = json.loads(raw[i:i + n + 1])
                sisa = raw[i + n + 1:]
                break
    tips = ambil_tips(sisa)
    return db, tips


def j(q):
    return json.dumps(q, ensure_ascii=False, separators=(', ', ': '))


def main():
    db, tips = baca()
    total = sum(len(v['soal']) for v in db.values())

    # index
    idx = {}
    for k, v in db.items():
        idx[k] = {'nama': v['nama'], 'jumlah': len(v['soal'])}
    with open(os.path.join(ROOT, 'data', 'soal-index.js'), 'w', encoding='utf-8') as f:
        f.write('// Dibuat otomatis oleh tools/pecah-data.py — jangan diedit manual.\n')
        f.write('window.DATA_SOAL_INDEX = ' + json.dumps(idx, ensure_ascii=False, separators=(', ', ': ')) + ';\n')
        f.write('window.DATA_SOAL_INDEX.total = %d;\n' % total)

    # per kategori
    for k, v in db.items():
        baris = ',\n'.join('    ' + j(q) for q in v['soal'])
        with open(os.path.join(ROOT, 'data', 'soal-%s.js' % k), 'w', encoding='utf-8') as f:
            f.write('// Dibuat otomatis oleh tools/pecah-data.py — jangan diedit manual.\n')
            f.write('(window.SOAL_PART = window.SOAL_PART || {})[%s] = {"nama": %s, "soal": [\n%s\n]};\n'
                    % (json.dumps(k), json.dumps(v['nama'], ensure_ascii=False), baris))

    # cadangan: seluruh data sekaligus (dipakai kalau file kategori gagal dimuat)
    blok = []
    for k, v in db.items():
        baris = ',\n'.join('    ' + j(q) for q in v['soal'])
        blok.append('  %s: {"nama": %s, "soal": [\n%s\n  ]}' % (json.dumps(k), json.dumps(v['nama'], ensure_ascii=False), baris))
    with open(os.path.join(ROOT, 'data', 'soal-penuh.js'), 'w', encoding='utf-8') as f:
        f.write('// Dibuat otomatis oleh tools/pecah-data.py — cadangan bila file per kategori gagal dimuat.\n')
        f.write('(function(){\n  var p = {\n' + ',\n'.join(blok) + '\n  };\n')
        f.write('  Object.keys(p).forEach(function(k){ SOAL_DATABASE[k] = p[k]; });\n})();\n')

    # tips
    with open(os.path.join(ROOT, 'data', 'tips.js'), 'w', encoding='utf-8') as f:
        f.write('// Dibuat otomatis oleh tools/pecah-data.py — jangan diedit manual.\n')
        f.write('const TIPS_DATA = ' + tips + ';\n')

    print('kategori:', len(db), '| total soal:', total)
    print('file dibuat: soal-index.js, %d file kategori, soal-penuh.js, tips.js' % len(db))


if __name__ == '__main__':
    main()

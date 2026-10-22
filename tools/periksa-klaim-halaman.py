#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Periksa kata terlarang di SEMUA halaman publik yang dibangun ke disk.

Latar belakang: gate lama hanya memeriksa `COPY_BELI` (copy varian A/B di Worker).
Akibatnya klaim terlarang di halaman LAIN lolos tanpa terdeteksi — dibuktikan
23 Okt 2026: `/contoh/` memuat "soal asli" (ada di daftar terlarang) dan tidak ada
pemeriksa yang menangkapnya, padahal halaman itu justru tujuan QR di flyer cetak.

Pemeriksa ini memindai HTML hasil build (bukan sumber naskah), sehingga menangkap
apa yang benar-benar dilihat pengunjung.

Pakai:
    python3 tools/periksa-klaim-halaman.py             # semua halaman
    python3 tools/periksa-klaim-halaman.py --verbose
"""
import html
import os
import re
import sys

AKAR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Frasa yang dilarang apa adanya di halaman publik. HANYA yang benar-benar klaim
# pemasaran — bukan kata yang muncul wajar dalam penjelasan materi.
TERLARANG = [
    'dijamin', 'pasti lulus', 'pasti diterima', 'satu-satunya',
    'bekerja sama dengan', 'akurat 100%', 'gratis selamanya',
    'akses terjual', 'sudah terjual', 'testimoni pembeli', 'soal asli',
    'nomor 1',   # ditangani khusus di bawah (hanya sebagai klaim peringkat)
    'terbaik',   # ditangani khusus di bawah (hanya sebagai klaim produk)
]

# Penyangkalan yang SAH — dihapus dulu sebelum pemeriksaan.
SAH = [
    r'bukan\s+(?:produk\s+|situs\s+|jadwal\s+)?resmi[^<.\']*',
    r'bukan\s+tes\s+resmi[^<.\']*',
    r'tidak\s+berafiliasi[^<.\']*',
    r'bukan\s+soal\s+dari\s+instansi[^<.\']*',
    r'bukan\s+bocoran[^<.\']*',
]

# Konteks di mana "resmi" WAJAR dan bukan klaim produk:
#   "instruksi resmi penguji", "pengumuman resmi seleksi", "prosedur resmi",
#   "kanal kontak resmi", "istilah resmi kisi-kisi", "ujian resmi",
#   "kumpulan resmi dari penyelenggara", "diumumkan resmi oleh panitia"
# Konteks di mana "resmi" WAJAR dan bukan klaim produk. Daftar ini sengaja LUAS:
# memeriksa halaman materi berarti ribuan kata wajar seperti "prosedur resmi",
# "informasi resmi", "tes IQ resmi? bukan". Yang ingin ditangkap HANYA klaim bahwa
# PRODUK KITA resmi/berafiliasi. Karena itu pendekatannya: cari klaim positif
# tentang produk, bukan memburu kata "resmi" di mana pun.
RESMI_WAJAR = re.compile(
    r'resmi\s+(?:penguji|seleksi|penyelenggara|instansi|pemerintah|panitia|kisi|'
    r'ujian|tahapan|kanal|prosedur|dokumen|naskah|aturan|jadwal|pengumuman|'
    r'menjadi|kepada|dari|oleh|dan|yang|ini|itu|tersebut|pembayaran|tes|'
    r'informasi|komando|karier|laman|hasil|skor|iq)|'
    r'(?:instruksi|pengumuman|prosedur|kanal|kontak|istilah|jadwal|ujian|naskah|'
    r'aturan|dokumen|kumpulan|diumumkan|lewat|melalui|secara|situs|informasi|'
    r'tanpa|bukan|atau|maupun|dan|serta|dari|pada)\s+resmi\b|'
    r'resmi\s*[?.]\s*(?:bukan|tidak)'
)

# Klaim positif yang benar-benar dilarang: menyatakan produk/situs ini RESMI
# atau berafiliasi. Ini yang sesungguhnya diburu.
KLAIM_RESMI_PRODUK = re.compile(
    r'(?:siap ?psikotes|situs ini|kami|produk ini|layanan ini|aplikasi ini)\s+'
    r'(?:adalah\s+|merupakan\s+)?(?:situs\s+|produk\s+|aplikasi\s+)?resmi|'
    # "resmi milik/dari" hanya klaim kalau subjeknya produk kita, jadi pola ini
    # sengaja dibatasi ke kata ganti orang pertama — bukan "kumpulan resmi dari
    # penyelenggara" yang justru penyangkalan.
    r'(?:kami|situs ini|siap ?psikotes)\s+resmi\s+(?:milik|dari)'
)

# Konteks di mana "terbaik"/"nomor 1" WAJAR: di dalam butir soal/opsi jawaban
# (mis. "buat keputusan terbaik"), bukan klaim produk.
KLAIM_TERBAIK = re.compile(
    r'(?:kami|kita|situs ini|siap ?psikotes|produk ini|layanan ini)\s+'
    r'(?:adalah\s+)?(?:yang\s+)?(?:terbaik|nomor\s*1|paling\s+baik)'
)

# Halaman yang diperiksa: semua index.html di direktori tingkat pertama,
# ditambah berkas HTML tunggal di akar.
KECUALI = {'.git', 'node_modules', 'static', 'aset-bisnis', 'docs', 'naskah',
           'tools', 'tests', '.gen', 'dashboard'}


def teks_halaman(jalur):
    """Ambil teks yang dilihat pengunjung: buang script/style/tag, decode entitas."""
    isi = open(jalur, encoding='utf-8', errors='ignore').read()
    isi = re.sub(r'<script.*?</script>', ' ', isi, flags=re.S | re.I)
    isi = re.sub(r'<style.*?</style>', ' ', isi, flags=re.S | re.I)
    isi = re.sub(r'<[^>]+>', ' ', isi)
    isi = html.unescape(isi)
    return re.sub(r'\s+', ' ', isi).lower()


def kumpulkan_halaman():
    hasil = []
    for nama in sorted(os.listdir(AKAR)):
        jalur = os.path.join(AKAR, nama)
        if nama in KECUALI or nama.startswith('.'):
            continue
        if os.path.isdir(jalur):
            idx = os.path.join(jalur, 'index.html')
            if os.path.exists(idx):
                hasil.append((nama + '/', idx))
        elif nama.endswith('.html'):
            hasil.append((nama, jalur))
    return hasil


def periksa(teks):
    """Kembalikan daftar pelanggaran pada satu teks halaman."""
    bersih = teks
    for pola in SAH:
        bersih = re.sub(pola, ' ', bersih)

    salah = []
    # Frasa keras (tidak ambigu)
    for k in TERLARANG:
        if k in ('nomor 1', 'terbaik'):
            continue          # ditangani lewat pola klaim di bawah
        if k in bersih:
            salah.append(k)

    # "terbaik"/"nomor 1" hanya pelanggaran kalau dipakai mengklaim produk/proyek.
    if KLAIM_TERBAIK.search(bersih):
        m = KLAIM_TERBAIK.search(bersih)
        salah.append('klaim peringkat: "%s"' % m.group(0)[:50])

    # "resmi": hanya pelanggaran kalau dipakai MENGKLAIM produk kita resmi.
    m = KLAIM_RESMI_PRODUK.search(bersih)
    if m:
        salah.append('klaim produk resmi: "…%s…"' % m.group(0)[:60])

    return salah


def main():
    verbose = '--verbose' in sys.argv
    halaman = kumpulkan_halaman()
    if not halaman:
        print('  GAGAL | tidak ada halaman yang bisa diperiksa')
        return 1

    total_salah = 0
    for nama, jalur in halaman:
        salah = periksa(teks_halaman(jalur))
        if salah:
            total_salah += 1
            print(f'  GAGAL | /{nama} -> {salah}')
            # Tampilkan konteks supaya mudah diperbaiki
            teks = teks_halaman(jalur)
            for frasa in salah:
                kunci = frasa.split(' ')[0]
                m = re.search(r'.{60}' + re.escape(kunci) + r'.{60}', teks)
                if m:
                    print(f'          …{m.group(0).strip()}…')
        elif verbose:
            print(f'  OK    | /{nama}')

    if total_salah:
        print(f'  RINGKAS: {total_salah} dari {len(halaman)} halaman memuat klaim terlarang')
        return 1
    print(f'  OK    | {len(halaman)} halaman bersih dari {len(TERLARANG)} frasa terlarang + klaim "resmi"')
    return 0


if __name__ == '__main__':
    sys.exit(main())

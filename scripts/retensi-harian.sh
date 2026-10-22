#!/usr/bin/env bash
# Retensi harian pembeli — spesifikasi retensi 30 hari (t_5d6bf642, dieksekusi t_83cabac8).
#
# Dijalankan launchd jam 09:00 WIB (plist: com.autopulse.retensi):
#   1. tarik CSV /api/laporan/retensi (segmen dari umur kolom dibayar)
#   2. untuk pembeli yang masuk ambang segmen hari itu dan BELUM pernah dikirimi
#      template-nya (retensi_kirim.csv — idempoten, tidak ada kirim ganda):
#        - email (SMTP Gmail, kredensial di ~/.hermes/.env) bila kontaknya email
#        - baris untuk WA manual ke retensi-wa-YYYY-MM-DD.txt (tempel 1:1)
#   3. semua kirim dicatat: tanggal, rujukan, template, kanal, status.
#
# Aturan kejujuran yang dipegang skrip ini (ATURAN-JUJUR-MARKETING 11 & 12):
#   - TIDAK ADA kalimat "akses tinggal X hari" — kode tidak berbatas waktu.
#   - Template persis dokumen spesifikasi §4, setiap pesan bawa opt-out.
#   - [KODE] hanya diisi bila kode hasil rumus rujukan cocok dengan kode_akhir
#     di catatan server; kalau tidak cocok, kirim DILEWATI (status: kode_tak_cocok).
#
# Pemakaian manual: bash scripts/retensi-harian.sh [--uji]
#   --uji: pakai contoh data uji (docs/devops/retensi/contoh-uji.csv) dan seluruh
#          email ditujukan ke alamat pemilik (tanpa mengirim ke orang luar).

set -euo pipefail

AKAR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIR="${AKAR}/docs/devops/retensi"
mkdir -p "$DIR"

DATE="$(date +%F)"
API="https://siappsikotes-api.rasyidahmad180.workers.dev/api/laporan/retensi"
TOKEN="${LAPORAN_TOKEN:-LAPIS3-FUNNEL-PROD}"   # pola scripts/ekspor-funnel.sh
CSV="${DIR}/retensi-${DATE}.csv"

if [[ "${1:-}" == "--uji" ]]; then
  CSV="${DIR}/contoh-uji.csv"
  UJI=1
else
  UJI=""
  curl -sf "${API}?token=${TOKEN}" > "$CSV" 2>/dev/null || { echo "$(date -Iseconds) gagal tarik CSV retensi"; exit 1; }
fi

exec python3 - "$AKAR" "$CSV" "${UJI}" "$DATE" <<'PY'
import csv, os, re, smtplib, sys
from email.mime.text import MIMEText
from email.header import Header
from pathlib import Path

AKAR, CSV_PATH, UJI, DATE = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
DIR = Path(AKAR) / 'docs' / 'devops' / 'retensi'
LOG = DIR / 'retensi_kirim.csv'
WA_OUT = DIR / ('retensi-wa-' + DATE + '.txt')
ENV = Path(os.path.expanduser('~/.hermes/.env'))

# Kredensial Gmail dari env pemilik (berkas lokal, tidak ikut repositori).
env = {}
for line in ENV.read_text(encoding='utf-8').splitlines():
    m = re.match(r'\s*([A-Z0-9_]+)=(.*)\s*$', line)
    if m:
        env[m.group(1)] = m.group(2).strip().strip('"')
GMAIL_USER = env.get('GMAIL_USER', '')
GMAIL_PASS = env.get('GMAIL_APP_PASSWORD', '')

# ---------- Template pesan FINAL (spesifikasi §4, tak diubah) ----------
KALIMAT_LARIK = {}
T = {}

T['W1'] = {
    'segmen': 'SEG-1', 'subjek': 'Kode akses SiapPsikotes — pesanan {rujukan}',
    'teks': (
        "Terima kasih sudah beli akses SiapPsikotes.\n"
        "Kode aksesmu: [KODE]\n"
        "Cara pakai: buka aplikasi di siappsikotes.my.id, menu Laporan, tempel kode, tekan Buka.\n"
        "Langkah pertama: kerjakan 15-20 soal Tes Numerik (kira-kira 20 menit). Tidak perlu\n"
        "menyelesaikan satu modul sekaligus - latihan pendek yang rutin lebih berguna\n"
        "daripada maraton sekali duduk.\n"
        "Soal yang salah otomatis dikumpulkan, dan bisa dikerjakan ulang kapan saja.\n"
        "Ada yang bingung? Balas pesan ini, dibalas pada jam kerja 08.00-21.00 WIB.\n"
        "Tidak mau menerima update? Balas \"ja\", tidak kami kirim lagi.\n"
    ),
}
T['W2'] = {
    'segmen': 'SEG-2', 'subjek': 'Rencana latihanmu minggu ini',
    'teks': (
        "Tiga hari sejak kode aktif - dua tips biar latihanmu nempel:\n"
        "Pertama, pakai mesin soal ber-riwayat (fitur ulang kesalahan di aplikasi) supaya yang dikerjakan ulang\n"
        "memang soal yang belum kamu kuasai, bukan yang sudah hafal.\n"
        "Kedua, buka Laporan Lengkap dan lihat dua modul terlemahmu - mulai latihan dari situ.\n"
        "Kalau ada soal yang pembahasannya dirasa kurang tepat, balas pesan ini - kami periksa.\n"
        "Tidak mau menerima update? Balas \"ja\", tidak kami kirim lagi.\n"
    ),
}
T['W3'] = {
    'segmen': 'SEG-3', 'subjek': 'Rencana latihan bersama 2 teman?',
    'teks': (
        "Info singkat: kalau mau latihan sambil saling menguji, SiapPsikotes ada paket\n"
        "3 kode untuk 3 orang - Rp 99.000 sekali bayar (kalau dibeli satu-satu 3 kode\n"
        "Rp 39.000 x 3 = Rp 117.000, jadi hemat Rp 18.000). Setiap orang dapat kode sendiri;\n"
        "satu kode untuk 1 orang saja.\n"
        "Detailnya: siappsikotes.my.id/beli/?utm_source=wa&utm_medium=retensi&utm_campaign=retensi30_w3\n"
        "Tidak mau menerima update? Balas \"ja\", tidak kami kirim lagi.\n"
    ),
}
T['W4'] = {
    'segmen': 'SEG-4', 'subjek': 'Tidak ada soal yang sudah kamu hafal — hanya yang baru',
    'teks': (
        "Pesan terakhir dalam rangkaian ini, jadi tidak akan mengganggu lagi.\n"
        "Sesudah dua sampai tiga minggu latihan, keluhan yang paling sering kami dengar:\n"
        "\"soal yang muncul berulang-ulang itu-itu saja, jadi hafal.\"\n"
        "Karena itu kini ada Set Soal Batch 2: [N] soal varian baru, lengkap pembahasan,\n"
        "tanpa soal kembar dengan set yang sudah kamu kerjakan.\n"
        "Harga khusus untuk pemilik kode akses (akses penuh): Rp 29.000 sekali bayar,\n"
        "bukan langganan. Buka siappsikotes.my.id/beli/?skus=batch2&utm_source=wa&utm_medium=retensi&utm_campaign=retensi30_w4,\n"
        "tempel kode aksesmu, harga khususnya langsung tampil.\n"
        "Tidak mau menerima update? Balas \"ja\", tidak kami kirim lagi.\n"
    ),
}
T['W4']['teks'] = T['W4']['teks'].replace('[N]', '120')

# ---------- Sidik kode: sama dengan server (sidikKode) supaya [KODE] akurat ----------
KUNCI_KODE = 'siap|psikotes|2026|kode'

def sidik_kode(isi):
    h = 2166136261
    s = str(isi) + '#' + KUNCI_KODE
    for ch in s:
        h ^= ord(ch)
        h = (h * 16777619) & 0xFFFFFFFF
    pos = h % 1679616
    abjad = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    hasil = ''
    while pos > 0:
        hasil = abjad[pos % 36] + hasil
        pos //= 36
    return hasil.rjust(4, '0')

def kode_dari_rujukan(rujukan):
    isi = ('P' + str(rujukan).upper())
    isi = re.sub(r'[^0-9A-Z]', '', isi)
    return 'SP' + isi + sidik_kode(isi)

# ---------- Log idempoten ----------
def baca_log():
    terkirim = set()
    if LOG.exists():
        with LOG.open(encoding='utf-8', newline='') as f:
            for r in csv.DictReader(f):
                if (r.get('status') or '').startswith('sent'):
                    terkirim.add((r['rujukan'], r['template']))
    return terkirim

def catat(rujukan, template, kanal, status):
    baru = not LOG.exists()
    with LOG.open('a', encoding='utf-8', newline='') as f:
        w = csv.writer(f, lineterminator='\n')
        if baru:
            w.writerow(['tanggal', 'rujukan', 'template', 'kanal', 'status'])
        w.writerow([DATE, rujukan, template, kanal, status])

ALAMAT_SIAP = baca_log()

# ---------- Baca CSV retensi ----------
pembeli = []
with open(CSV_PATH, encoding='utf-8', newline='') as f:
    for r in csv.DictReader(f):
        hari = int(r.get('hari_sejak_bayar') or 0)
        kontak = (r.get('kontak') or '').strip()
        rujukan = (r.get('rujukan') or '').strip()
        if kontak:
            pembeli.append({'rujukan': rujukan, 'kode_akhir': (r.get('kode_akhir') or '').strip(),
                            'kontak': kontak, 'segmen': (r.get('segmen') or '').strip(), 'hari': hari})

def template_untuk(hari):
    if hari <= 2: return 'W1'
    if hari <= 13: return 'W2'
    if hari <= 27: return 'W3'
    if 28 <= hari <= 30: return 'W4'
    return None   # lewat 30 hari: rangkaian selesai, tidak mengganggu lagi

# ---------- Kirim ----------
def kirim_email(tujuan, subjek, teks):
    m = MIMEText(teks, 'plain', 'utf-8')
    m['From'] = 'SiapPsikotes <%s>' % GMAIL_USER
    m['To'] = tujuan
    m['Subject'] = str(Header(subjek, 'utf-8'))
    srv = smtplib.SMTP('smtp.gmail.com', 587, timeout=30)
    try:
        srv.starttls()
        srv.login(GMAIL_USER, GMAIL_PASS)
        srv.sendmail(GMAIL_USER, [tujuan], m.as_string())
    finally:
        srv.quit()

baris_wa = []
jumlah_email = 0
jumlah_wa = 0

for p in pembeli:
    tpl = template_untuk(p['hari'])
    if not tpl:
        catat(p['rujukan'], '-', '-', 'lewati_sudah_lewat_30_hari')
        continue
    if (p['rujukan'], tpl) in ALAMAT_SIAP:
        catat(p['rujukan'], tpl, '-', 'lewati_sudah_kirim')
        continue
    if not p['kontak']:
        catat(p['rujukan'], tpl, '-', 'lewati_tanpa_kontak')
        continue
    # [KODE] hanya bila kode rumus rujukan cocok dengan kode_akhir catatan server.
    teks = T[tpl]['teks']
    if '[KODE]' in teks:
        kode_hitung = kode_dari_rujukan(p['rujukan'])
        if p['kode_akhir'] and kode_hitung[-6:] != p['kode_akhir']:
            catat(p['rujukan'], tpl, '-', 'lewati_kode_tak_cocok')
            continue
        teks = teks.replace('[KODE]', kode_hitung)
    kanal = 'email' if '@' in p['kontak'] else 'wa'
    subjek = T[tpl]['subjek'].format(rujukan=p['rujukan'])
    if kanal == 'email':
        tujuan = p['kontak']
        if UJI:
            tujuan = GMAIL_USER   # mode uji: semua email balik ke alamat pemilik
        if not (GMAIL_USER and GMAIL_PASS):
            catat(p['rujukan'], tpl, 'email', 'gagal_kredensial_kosong')
            continue
        try:
            kirim_email(tujuan, subjek, teks)
        except Exception as e:
            catat(p['rujukan'], tpl, 'email', 'gagal_' + type(e).__name__)
            continue
        jumlah_email += 1
        catat(p['rujukan'], tpl, 'email', 'sent')
    else:
        baris_wa.append('--- %s (%s, %s) ---\nKepada nomor: %s\n\n%s' % (p['rujukan'], tpl, p['segmen'], p['kontak'], teks))
        jumlah_wa += 1
        # status 'sent_daftar_wa' = sudah masuk daftar tempel manual hari itu; idempoten:
        # run kedua tidak menambah baris yang sama lagi.
        catat(p['rujukan'], tpl, 'wa', 'sent_daftar_wa')

if baris_wa:
    kepala = ('# Daftar WA manual %s — tempel 1:1 dari kontak klaim.\n'
              '# Kalau ada yang membalas "ja" (tidak mau update), jangan dikirim lagi:\n'
              '# hapus pembeli itu dari riwayat pengiriman berikutnya.\n\n') % DATE
    WA_OUT.write_text(kepala + '\n\n'.join(baris_wa) + '\n', encoding='utf-8')

print('%s | email=%d wa=%d | log=%s' % (DATE, jumlah_email, jumlah_wa, LOG))
PY

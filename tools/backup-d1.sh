#!/usr/bin/env bash
# Backup harian database D1 SiapPsikotes (data pembeli, pembayaran, kode akses).
#
# KENAPA ADA
# Sampai 2026-10-24 tidak ada backup sama sekali. Cloudflare Time Travel ada (bookmark
# bisa dipulihkan ~30 hari), tetapi itu TIDAK menolong kalau: akun Cloudflare hilang,
# database terhapus, atau butuh salinan di luar Cloudflare. Isi database ini adalah
# satu-satunya catatan siapa yang sudah membayar dan kode akses apa yang terbit.
#
# PAKAI
#   bash tools/backup-d1.sh              # backup, simpan 14 terakhir
#   bash tools/backup-d1.sh --verifikasi # cek backup terakhir benar-benar bisa dipulihkan
#
# Hasil: ~/backup/siappsikotes/d1-YYYYmmdd-HHMM.sql.gz  (~66 KB terkompresi)

set -euo pipefail

SEKARANG=$(TZ=Asia/Jakarta date +%Y%m%d-%H%M)
TUJUAN_DIR="$HOME/backup/siappsikotes"
SERVER_DIR="$HOME/tni-belajar/server"
DB="siappsikotes-db"
SIMPAN=14

mkdir -p "$TUJUAN_DIR"

if [ "${1:-}" = "--verifikasi" ]; then
  BERKAS=$(ls -t "$TUJUAN_DIR"/d1-*.sql.gz 2>/dev/null | head -1)
  if [ -z "$BERKAS" ]; then
    echo "GAGAL: tidak ada berkas backup di $TUJUAN_DIR"
    exit 1
  fi
  echo "memeriksa: $BERKAS"
  TABEL=$(gzip -dc "$BERKAS" | grep -c 'CREATE TABLE' || true)
  INS=$(gzip -dc "$BERKAS" | grep -c 'INSERT INTO "' || true)
  BAYAR=$(gzip -dc "$BERKAS" | grep -c 'INSERT INTO "payments"' || true)
  echo "  CREATE TABLE : $TABEL"
  echo "  INSERT total : $INS"
  echo "  payments     : $BAYAR"
  if [ "$TABEL" -lt 5 ] || [ "$INS" -lt 100 ]; then
    echo "GAGAL: backup tampak tidak lengkap"
    exit 1
  fi
  echo "OK: backup lengkap"
  exit 0
fi

TMP="$TUJUAN_DIR/d1-$SEKARANG.sql"
echo "mengekspor $DB ..."
(cd "$SERVER_DIR" && npx wrangler d1 export "$DB" --remote --output="$TMP" >/dev/null 2>&1)

if [ ! -s "$TMP" ]; then
  echo "GAGAL: export tidak menghasilkan berkas"
  exit 1
fi

gzip -9 -f "$TMP"
BERKAS="$TMP.gz"

# Verifikasi cepat: berkas harus memuat skema DAN data.
TABEL=$(gzip -dc "$BERKAS" | grep -c 'CREATE TABLE' || true)
INS=$(gzip -dc "$BERKAS" | grep -c 'INSERT INTO "' || true)
if [ "$TABEL" -lt 5 ] || [ "$INS" -lt 100 ]; then
  echo "GAGAL: hasil export tidak lengkap ($TABEL tabel, $INS insert)"
  exit 1
fi

UKURAN=$(du -h "$BERKAS" | cut -f1)
echo "OK: $(basename "$BERKAS") ($UKURAN, $TABEL tabel, $INS insert)"

# Simpan hanya $SIMPAN berkas terbaru.
JUMLAH=$(ls -1 "$TUJUAN_DIR"/d1-*.sql.gz 2>/dev/null | wc -l | tr -d ' ')
if [ "$JUMLAH" -gt "$SIMPAN" ]; then
  ls -1t "$TUJUAN_DIR"/d1-*.sql.gz | tail -n +$((SIMPAN + 1)) | while read -r lama; do
    rm -f "$lama"
    echo "  hapus backup lama: $(basename "$lama")"
  done
fi

#!/usr/bin/env bash
# Gerbang pemeriksaan sebelum kirim (pre-push).
#
# Menjalankan SEMUA pemeriksaan cepat yang sama dengan CI:
#   1. PERATURAN MUTU SOAL (11 butir)
#   2. Verifikasi bank soal (akurasi, konsistensi versi aset, gambar)
#   3. Pemeriksaan sintaks seluruh JavaScript
#   4. Merek & identitas (tanpa merek lama)
#   5. Penyangkalan afiliasi di semua halaman publik
#   6. Uji runtime aplikasi (9 kategori, gambar, tryout, dst - sama dengan CI)
#   7. Uji peramban seluruh fitur aplikasi
#   8. Uji tampilan halaman pendukung (/mutu/, /beli/, /syarat/, /privasi/)
#
# Kalau ada satu saja gagal, pengiriman DIBATALKAN. Ini mencegah kejadian
# berulang: CI merah karena pemeriksaan yang sebenarnya bisa dijalankan lokal.
#
# Pemakaian:  bash tools/periksa-sebelum-kirim.sh            # lengkap (termasuk uji peramban)
#            bash tools/periksa-sebelum-kirim.sh --cepat   # lewati uji peramban
# Hook:       .git/hooks/pre-push memanggil skrip ini (lihat tools/pasang-hook.py)

set -u
AKAR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$AKAR" || exit 1

PY=/usr/bin/python3
# Python sistem bisa mati (mis. macOS: lisensi Xcode belum disetujui -> rc=69).
# Pakai penerjemah pertama yang benar-benar bisa dijalankan supaya gerbang tidak
# melaporkan kegagalan produk hanya karena lingkungan.
if ! "$PY" -c "pass" >/dev/null 2>&1; then
  for KANDIDAT in /opt/homebrew/bin/python3 "$(command -v python3 2>/dev/null || true)"; do
    [ -n "$KANDIDAT" ] || continue
    if [ -x "$KANDIDAT" ] && "$KANDIDAT" -c "pass" >/dev/null 2>&1; then
      PY="$KANDIDAT"
      break
    fi
  done
  echo "  catatan | penerjemah Python: $PY"
fi
GAGAL=0

echo "=== 1/7 PERATURAN MUTU SOAL (11 butir) ==="
if ! $PY tools/peraturan-mutu.py; then
  echo ">>> GAGAL: peraturan mutu soal tidak dipatuhi"
  GAGAL=1
fi

echo
echo "=== 2/7 VERIFIKASI BANK SOAL ==="
if ! $PY tools/verifikasi-soal.py; then
  echo ">>> GAGAL: verifikasi bank soal tidak lulus"
  GAGAL=1
fi

echo
echo "=== 3/7 SINTAKS JAVASCRIPT ==="
if command -v node > /dev/null 2>&1; then
  for f in static/js/*.js data/*.js sw.js; do
    [ -f "$f" ] || continue
    if ! node --check "$f" > /dev/null 2>&1; then
      echo "  GAGAL | sintaks: $f"
      node --check "$f" 2>&1 | head -3
      GAGAL=1
    fi
  done
  [ "$GAGAL" -eq 0 ] && echo "  OK    | seluruh JavaScript lolos pemeriksaan sintaks"
else
  echo "  (node tidak tersedia - pemeriksaan sintaks dilewati)"
fi

echo
echo "=== 4/7 MEREK & IDENTITAS ==="
MEREK_GAGAL=0
for f in index.html manifest.json sw.js static/js/*.js data/*.js; do
  [ -f "$f" ] || continue
  if grep -q "PK Perwira" "$f" 2>/dev/null; then
    echo "  GAGAL | merek lama 'PK Perwira' masih ada di $f"
    MEREK_GAGAL=1
  fi
done
if [ "$MEREK_GAGAL" -eq 0 ]; then
  echo "  OK    | tidak ada merek lama di berkas yang dilihat pengguna"
else
  GAGAL=1
fi

echo
echo "=== 5/7 PENYANGKALAN AFILIASI ==="
SANGKAL_GAGAL=0
for f in index.html psikotes/index.html mutu/index.html syarat/index.html privasi/index.html contoh/index.html lisensi/index.html 404.html; do
  [ -f "$f" ] || continue
  if ! grep -qi "bukan produk resmi instansi\|tidak berafiliasi dengan" "$f" 2>/dev/null; then
    echo "  GAGAL | $f belum memuat penyangkalan afiliasi"
    SANGKAL_GAGAL=1
  fi
done
if [ "$SANGKAL_GAGAL" -eq 0 ]; then
  echo "  OK    | semua halaman publik memuat penyangkalan afiliasi"
else
  GAGAL=1
fi

echo
echo "=== 6/8 UJI RUNTIME APLIKASI (sama dengan CI) ==="
if [ "${1:-}" = "--cepat" ]; then
  echo "  (dilewati karena --cepat - JANGAN kirim bila menambah atau mengubah fitur)"
else
  if ! $PY tools/uji-runtime.py; then
    echo ">>> GAGAL: uji runtime tidak lulus"
    GAGAL=1
  fi
fi

echo
echo "=== 7/8 UJI PERAMBAN SELURUH FITUR (sama dengan CI) ==="
if [ "${1:-}" = "--cepat" ]; then
  echo "  (dilewati karena --cepat - JANGAN kirim bila menambah atau mengubah fitur)"
else
  if ! $PY tools/uji-fitur-lengkap.py; then
    echo ">>> GAGAL: uji peramban tidak lulus"
    GAGAL=1
  fi
fi

echo
echo "=== 8/8 UJI TAMPILAN HALAMAN PENDUKUNG (/mutu/, /beli/, /syarat/, /privasi/) ==="
if [ "${1:-}" = "--cepat" ]; then
  echo "  (dilewati karena --cepat - jalankan bila menyentuh halaman pendukung)"
else
  if ! $PY tools/uji-tampilan-pendukung.py; then
    echo ">>> GAGAL: tampilan halaman pendukung tidak lulus"
    GAGAL=1
  fi
fi

echo
echo "=== 9/9 KARTU PRATINJAU HALAMAN (OG IMAGE) ==="
if ! $PY tools/buat-gambar-og.py --periksa; then
  echo ">>> GAGAL: kartu pratinjau halaman tidak lengkap"
  GAGAL=1
fi
if ! $PY tools/pasang-seo.py --periksa; then
  echo ">>> GAGAL: tag gambar pratinjau tidak cocok dengan halamannya"
  echo "    perbaiki dengan: $PY tools/pasang-seo.py"
  GAGAL=1
fi

echo
if [ "$GAGAL" -ne 0 ]; then
  echo "=============================================="
  echo "PENGIRIMAN DIBATALKAN - perbaiki dulu di atas."
  echo "=============================================="
  exit 1
fi
echo "SEMUA PEMERIKSAAN LULUS - aman untuk dikirim"
exit 0

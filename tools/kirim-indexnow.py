#!/usr/bin/env python3
"""Kirim alamat halaman situs ke IndexNow (Bing, Yandex, Seznam, Naver).

Situs ini sudah punya peta situs yang rapi, tetapi peta situs hanya dibaca saat
mesin pencari memutuskan untuk merayap. IndexNow membalik arahnya: kita yang
memberi tahu mesin pencari begitu ada halaman baru atau berubah.

Kunci:

    Berkas kunci (nama berkas 32-128 huruf heksadesimal, isinya kunci yang
    sama) sudah ada di akar repo dan sudah publik di situs. Skrip ini membaca
    berkas itu, jadi tidak ada rahasia baru yang perlu disimpan.

Dipakai oleh .github/workflows/indexnow.yml. Bisa juga dijalankan sendiri:

    python3 tools/kirim-indexnow.py

Keluaran ringkas ditulis ke .gen/indexnow-hasil.txt (folder .gen/ sudah
diabaikan git).
"""

from __future__ import annotations

import json
import pathlib
import re
import sys
import time
import urllib.error
import urllib.request

SITUS = "https://siappsikotes.my.id"
ENDPOINT = "https://api.indexnow.org/indexnow"
AKAR = pathlib.Path(__file__).resolve().parent.parent
PETA_SITUS = AKAR / "sitemap.xml"
BERKAS_HASIL = AKAR / ".gen" / "indexnow-hasil.txt"
POLA_KUNCI = re.compile(r"^[0-9a-f]{32,128}$")
POLA_LOC = re.compile(r"<loc>\s*(.*?)\s*</loc>", re.S)


def cari_kunci() -> str:
    """Ambil kunci IndexNow dari berkas di akar repo."""
    for berkas in sorted(AKAR.glob("*.txt")):
        nama = berkas.stem
        if not POLA_KUNCI.match(nama):
            continue
        isi = berkas.read_text(encoding="utf-8").strip()
        if isi == nama:
            return isi
    raise SystemExit(
        "Kunci IndexNow tidak ditemukan: harus ada berkas <kunci>.txt di akar "
        "repo yang isinya sama dengan nama berkasnya."
    )


def baca_alamat() -> list[str]:
    """Ambil daftar alamat dari peta situs."""
    if not PETA_SITUS.exists():
        raise SystemExit("sitemap.xml tidak ada di akar repo.")
    alamat = [u.strip() for u in POLA_LOC.findall(PETA_SITUS.read_text(encoding="utf-8"))]
    # Buang duplikat tetapi pertahankan urutan.
    unik: list[str] = []
    for u in alamat:
        if u.startswith("http") and u not in unik:
            unik.append(u)
    if not unik:
        raise SystemExit("sitemap.xml tidak memuat satu pun alamat.")
    return unik


def status_alamat(alamat: str) -> int:
    """Kode HTTP satu alamat; 0 kalau tidak terjangkau."""
    req = urllib.request.Request(alamat, method="HEAD", headers={"User-Agent": "siappsikotes-indexnow/1"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return e.code
    except Exception:
        return 0


def saring_hidup(alamat: list[str]) -> tuple[list[str], list[str]]:
    """Pisahkan alamat yang sudah bisa diakses dari yang belum.

    Alamat yang belum hidup (mis. deploy masih berjalan) dicoba sekali lagi
    setelah jeda singkat sebelum dianggap gagal.
    """
    hidup: list[str] = []
    gagal: list[str] = []
    for u in alamat:
        if status_alamat(u) == 200:
            hidup.append(u)
        else:
            gagal.append(u)

    if gagal:
        print(f"Menunggu deploy untuk {len(gagal)} alamat yang belum hidup...")
        time.sleep(45)
        masih_gagal: list[str] = []
        for u in gagal:
            if status_alamat(u) == 200:
                hidup.append(u)
            else:
                masih_gagal.append(u)
        gagal = masih_gagal
    return hidup, gagal


def kirim(kunci: str, alamat: list[str]) -> int:
    """Kirim daftar alamat ke IndexNow; kembalikan kode HTTP."""
    muatan = {
        "host": "siappsikotes.my.id",
        "key": kunci,
        "keyLocation": f"{SITUS}/{kunci}.txt",
        "urlList": alamat,
    }
    req = urllib.request.Request(
        ENDPOINT,
        data=json.dumps(muatan, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status
    except urllib.error.HTTPError as e:
        badan = e.read().decode("utf-8", "replace")[:300]
        print(f"IndexNow menolak: HTTP {e.code} {e.reason} {badan}", file=sys.stderr)
        return e.code
    except Exception as e:  # jaringan mati, DNS gagal, dan sejenisnya
        print(f"IndexNow tidak terjangkau: {e}", file=sys.stderr)
        return 0


def main() -> int:
    kunci = cari_kunci()
    semua = baca_alamat()
    hidup, gagal = saring_hidup(semua)

    if not hidup:
        raise SystemExit("Tidak ada satu pun alamat yang bisa diakses; pengiriman dibatalkan.")

    kode = kirim(kunci, hidup)
    baris = [
        f"IndexNow: {len(hidup)} dari {len(semua)} alamat dikirim (HTTP {kode}).",
        f"Kunci: {kunci[:8]}... ({SITUS}/{kunci}.txt)",
    ]
    if gagal:
        baris.append(f"Belum hidup, tidak dikirim ({len(gagal)}): " + ", ".join(gagal))
    teks = "\n".join(baris)
    print(teks)
    BERKAS_HASIL.parent.mkdir(parents=True, exist_ok=True)
    BERKAS_HASIL.write_text(teks + "\n", encoding="utf-8")

    # 200 = diterima, 202 = diterima dan sedang diperiksa. Selain itu dianggap gagal.
    if kode in (200, 202):
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())

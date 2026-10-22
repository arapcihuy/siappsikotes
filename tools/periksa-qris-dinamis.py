#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Periksa QRIS di /beli/ benar-benar DINAMIS dan nominalnya cocok.

MASALAH YANG DIJAGA
QRIS di /beli/ adalah QRIS statis tanpa tag 54 (nominal). Pembeli harus mengetik
nominal sendiri termasuk 3 angka unik rujukan — sumber utama salah ketik dan
pembayaran tidak tercocok. Solusinya: isi tag 54 di klien lalu hitung ulang CRC.

Uji ini menjaga tiga hal sekaligus:
  1. modul qris-dinamis.js menghasilkan CRC yang benar (diuji lawan CRC QRIS asli)
  2. QR yang benar-benar dirender di peramban membawa tag 54 = nominal di halaman
  3. tidak ada regresi ke QR statis (atribut data-qris-dinamis wajib ada)

Pakai:
    /Users/mac/venv312/bin/python3 tools/periksa-qris-dinamis.py [--url http://127.0.0.1:8799]
"""
import base64
import glob
import os
import sys

AKAR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def tlv(s):
    out = {}
    i = 0
    while i + 4 <= len(s):
        tag = s[i:i + 2]
        try:
            ln = int(s[i + 2:i + 4])
        except ValueError:
            break
        val = s[i + 4:i + 4 + ln]
        if len(val) != ln:
            break
        out[tag] = val
        i += 4 + ln
    return out


def crc16(s):
    crc = 0xFFFF
    for ch in s.encode("utf-8"):
        crc ^= ch << 8
        for _ in range(8):
            crc = ((crc << 1) ^ 0x1021) & 0xFFFF if (crc & 0x8000) else (crc << 1) & 0xFFFF
    return f"{crc:04X}"


def main():
    url = "http://127.0.0.1:8799"
    if "--url" in sys.argv:
        url = sys.argv[sys.argv.index("--url") + 1]

    # --- 1. uji modul: CRC harus mereproduksi CRC QRIS asli ---
    js = os.path.join(AKAR, "static", "js", "qris-dinamis.js")
    if not os.path.exists(js):
        print("  GAGAL | static/js/qris-dinamis.js tidak ada")
        return 1
    isi = open(js, encoding="utf-8").read()
    import re
    # Ambil hanya blok penetapan QRIS_STATIS, lalu buang kutip, '+', dan SEMUA
    # whitespace (payload ditulis terpecah beberapa baris dengan operator '+').
    blok = re.search(r"QRIS_STATIS\s*=\s*(.+?);", isi, re.S)
    if not blok:
        print("  GAGAL | variabel QRIS_STATIS tidak ditemukan di modul")
        return 1
    # Ambil ISI setiap literal string lalu gabungkan. JANGAN membuang spasi:
    # nama merchant "Momo dimsum" memuat spasi yang wajib dipertahankan.
    potongan = re.findall(r"'([^']*)'", blok.group(1))
    if not potongan:
        print("  GAGAL | literal string payload tidak ditemukan di modul")
        return 1
    gabung = "".join(potongan).strip()
    m = re.search(r"00020101[0-9A-Za-z .\-]+", gabung)
    if not m:
        print("  GAGAL | payload QRIS statis tidak ditemukan di modul")
        return 1
    statis = m.group(0)
    if crc16(statis[:-4]) != statis[-4:]:
        print(f"  GAGAL | CRC QRIS statis di modul tidak valid ({statis[-4:]})")
        return 1

    # --- 2. uji di peramban: QR yang dirender harus membawa tag 54 yang cocok ---
    try:
        import cv2
        from playwright.sync_api import sync_playwright
    except ImportError as e:
        print(f"  LEWATI | dependensi tidak lengkap: {e}")
        return 0

    kandidat = sorted(glob.glob(os.path.expanduser(
        "~/Library/Caches/ms-playwright/chromium_headless_shell-*/"
        "chrome-headless-shell-mac-arm64/chrome-headless-shell")))
    if not kandidat:
        print("  LEWATI | chrome-headless-shell tidak ada di cache")
        return 0

    ok = True
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=kandidat[-1])
        ctx = b.new_context(viewport={"width": 390, "height": 844})
        page = ctx.new_page()
        page.goto(f"{url}/beli/?utm_source=uji-qris", wait_until="domcontentloaded", timeout=40000)
        page.wait_for_timeout(2500)

        d = page.evaluate("""() => {
            const img = document.querySelector('#qris img');
            const nom = document.getElementById('beliNominal');
            return {
                dinamis: img ? img.getAttribute('data-qris-dinamis') : null,
                src: img ? img.src : '',
                nominal: nom ? nom.textContent.trim() : ''
            };
        }""")

        if d["dinamis"] != "1":
            print(f"  GAGAL | QR /beli/ masih statis (data-qris-dinamis={d['dinamis']})")
            ok = False
        elif not d["src"].startswith("data:image"):
            print("  GAGAL | QR dinamis tidak dirender sebagai data URL")
            ok = False
        else:
            berkas = "/tmp/_periksa_qr.png"
            with open(berkas, "wb") as f:
                f.write(base64.b64decode(d["src"].split(",")[1]))
            data, _pts, _ = cv2.QRCodeDetector().detectAndDecode(cv2.imread(berkas))
            if not data:
                print("  GAGAL | QR dinamis tidak bisa didekode")
                ok = False
            else:
                t = tlv(data)
                nominal_qr = t.get("54")
                nominal_hal = d["nominal"].replace("Rp", "").replace(".", "").strip()
                if not nominal_qr:
                    print("  GAGAL | QR dinamis tidak membawa tag 54 (nominal)")
                    ok = False
                elif nominal_qr != nominal_hal:
                    print(f"  GAGAL | nominal QR ({nominal_qr}) != nominal halaman ({nominal_hal})")
                    ok = False
                elif crc16(data[:-4]) != data[-4:]:
                    print("  GAGAL | CRC QR dinamis tidak valid")
                    ok = False
                else:
                    print(f"  OK    | QR dinamis: nominal {nominal_qr} = halaman, CRC valid, merchant {t.get('59')}")
        ctx.close()
        b.close()

    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())

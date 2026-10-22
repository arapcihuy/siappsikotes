#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Bangun payload QRIS DINAMIS dari QRIS statis + nominal (tag 54 + CRC ulang).

MASALAH YANG DIPECAHKAN
QRIS yang dipakai /beli/ adalah QRIS STATIS: tidak ada tag 54 (nominal transaksi).
Akibatnya pembeli harus MENGETIK sendiri nominal, termasuk 3 angka unik rujukan
(mis. Rp 39.651). Dua akibat buruk:

  1. Pembeli bisa salah ketik -> nominal tidak cocok -> pembayaran tidak terdeteksi
     otomatis, harus dicek manual, kode akses tertunda.
  2. Gesekan tinggi: mengetik 6 digit di tengah proses bayar adalah titik paling
     sering ditinggalkan.

Dengan mengisi tag 54, nominal langsung terisi di aplikasi bank/e-wallet pembeli
saat QR dipindai. Pembeli tidak perlu mengetik apa pun.

CARA KERJA
QRIS mengikuti EMVCo TLV: [tag 2 digit][panjang 2 digit][nilai]. Nominal ada di
tag 54 dengan panjang berapa pun. Setelah TLV diubah, tag 63 (CRC16-CCITT) HARUS
dihitung ulang, kalau tidak aplikasi pembayar akan menolak QR-nya.

Pakai:
    /Users/mac/venv312/bin/python3 tools/qris-dinamis.py 39651
    /Users/mac/venv312/bin/python3 tools/qris-dinamis.py 39651 --png out.png
"""
import sys


def tlv_parse(s):
    """Urai string EMVCo menjadi list (tag, panjang, nilai)."""
    out = []
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
        out.append([tag, ln, val])
        i += 4 + ln
    return out


def tlv_build(items):
    return "".join(f"{t}{len(v):02d}{v}" for t, _ln, v in items)


def crc16_ccitt(data: str) -> str:
    """CRC16-CCITT-FALSE (poly 0x1021, init 0xFFFF) — standar QRIS tag 63."""
    crc = 0xFFFF
    for ch in data.encode("utf-8"):
        crc ^= ch << 8
        for _ in range(8):
            crc = ((crc << 1) ^ 0x1021) & 0xFFFF if (crc & 0x8000) else (crc << 1) & 0xFFFF
    return f"{crc:04X}"


def buat_dinamis(statis: str, nominal: int) -> str:
    """Sisipkan tag 54 (nominal) lalu hitung ulang CRC tag 63."""
    items = tlv_parse(statis)
    if not items:
        raise ValueError("payload statis tidak bisa diurai")

    # Buang tag 54 lama (kalau ada) dan tag 63 (CRC), sisipkan 54 di posisi wajar
    bersih = []
    for t, ln, v in items:
        if t in ("54", "63"):
            continue
        bersih.append([t, ln, v])

    # Tag 54 harus berada setelah tag 53 (mata uang). Kalau 53 tidak ada,
    # letakkan setelah tag terakhir sebelum 55/56/57/58.
    sisip = len(bersih)
    for idx, (t, _ln, _v) in enumerate(bersih):
        if t == "53":
            sisip = idx + 1
            break
    bersih.insert(sisip, ["54", 0, str(nominal)])

    # Bangun tanpa CRC lalu tambahkan tag 63 kosong untuk menghitung
    isi = tlv_build(bersih) + "6304"
    return isi + crc16_ccitt(isi)


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    nominal = int(sys.argv[1])

    # QRIS statis milik SiapPsikotes (merchant "Momo dimsum — Sleman",
    # kanal pembayaran pengelola; sudah diumumkan terbuka di /beli/).
    statis = (
        "00020101021126610014COM.GO-JEK.WWW01189360091430513430280210G0513430280"
        "303UMI51440014ID.CO.QRIS.WWW0215ID10265127403780303UMI5204581253033605802"
        "ID5911Momo dimsum6006SLEMAN61055528562140703A01110362163045BA7"
    )

    dinamis = buat_dinamis(statis, nominal)
    print(f"statis  ({len(statis)} char): {statis}")
    print(f"dinamis ({len(dinamis)} char): {dinamis}")

    # Verifikasi: tag 54 ada dan CRC benar
    items = tlv_parse(dinamis)
    d = {t: v for t, _l, v in items}
    print(f"\ntag 54 (nominal) : {d.get('54', 'TIDAK ADA')}")
    print(f"tag 59 (merchant): {d.get('59')}")
    tanpa_crc = dinamis[:-4]
    print(f"CRC cocok        : {crc16_ccitt(tanpa_crc) == d.get('63')}")

    if "--png" in sys.argv:
        jalur = sys.argv[sys.argv.index("--png") + 1]
        import qrcode
        qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=10, border=2)
        qr.add_data(dinamis)
        qr.make(fit=True)
        qr.make_image(fill_color="black", back_color="white").save(jalur)
        print(f"PNG ditulis      : {jalur}")

        # Uji balik: dekode PNG dan pastikan isinya sama
        import cv2
        img = cv2.imread(jalur)
        hasil, _pts, _ = cv2.QRCodeDetector().detectAndDecode(img)
        print(f"dekode ulang OK  : {hasil == dinamis}")
        if hasil != dinamis:
            print(f"  dapat: {hasil[:80]}...")

    return 0


if __name__ == "__main__":
    sys.exit(main())

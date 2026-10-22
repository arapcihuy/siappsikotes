#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Uji rantai pembayaran SiapPsikotes ujung-ke-ujung, lalu bersihkan jejaknya.

RANTAI YANG DIUJI (yang menentukan apakah uang masuk -> kode keluar):
  1. Pembeli memesan        : POST /api/beli/kode  -> rujukan SP-xxx + nominal unik
  2. Pembayaran masuk       : POST /api/payment-webhook (X-Webhook-Secret, nominal TEPAT)
  3. Pesanan jadi lunas     : GET  /api/beli/status -> status == 'lunas'
  4. Kode ditandai dibayar  : tabel kode_terbit.dibayar terisi, asal 'webhook-auto'
  5. Klaim berhasil         : POST /api/beli/klaim  -> ok:true, pesan "lunas"
  6. Kode referral terbit   : kode_terbit/ref -> REF-XXXX muncul

KENAPA INI PENTING
Sebelumnya hanya halaman /beli/ yang diuji (HTTP 200). HTTP 200 tidak membuktikan
bahwa pembayaran nyata menghasilkan kode akses. Kalau salah satu sambungan putus,
pembeli bisa membayar dan tidak pernah menerima apa pun — kegagalan paling mahal
yang mungkin terjadi pada bisnis ini.

Bersih-bersih WAJIB: semua baris uji dihapus berdasarkan rujukan uji + txid uji.
Memakai rujukan acak SP-9xx agar tidak menabrak pesanan nyata.

Pakai:
    python3 tools/uji-rantai-bayar.py
    python3 tools/uji-rantai-bayar.py --simpan     # jangan hapus jejak (debug)
"""
import json
import os
import random
import subprocess
import sys
import time

API = "https://siappsikotes-api.rasyidahmad180.workers.dev"
DB = "siappsikotes-db"
DIR_SERVER = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "server")
SECRET_PATH = os.path.expanduser("~/.hermes/secrets/siappsikotes-payment-webhook.txt")


def curl(jalan, metode="GET", isi=None, headers=None):
    cmd = ["curl", "-sS", "-m", "30", "-X", metode, API + jalan,
           "-H", "content-type: application/json", "-w", "\n%{http_code}"]
    if isi is not None:
        cmd += ["-d", json.dumps(isi)]
    for k, v in (headers or {}).items():
        cmd += ["-H", f"{k}: {v}"]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=45)
    baris = (r.stdout or "").strip().split("\n")
    try:
        kode = int(baris[-1])
    except ValueError:
        return 0, {"mentah": (r.stdout or r.stderr)[:200]}
    badan = "\n".join(baris[:-1])
    try:
        return kode, json.loads(badan) if badan else {}
    except json.JSONDecodeError:
        return kode, {"mentah": badan[:200]}


def d1(sql):
    r = subprocess.run(
        ["npx", "wrangler", "d1", "execute", DB, "--remote", "--json", "--command", sql],
        cwd=DIR_SERVER, capture_output=True, text=True, timeout=120)
    keluaran = (r.stdout or "") + (r.stderr or "")
    i, j = keluaran.find("["), keluaran.rfind("]")
    if i < 0 or j < 0:
        return None
    try:
        return json.loads(keluaran[i:j + 1])[0].get("results")
    except Exception:
        return None


def main():
    if not os.path.exists(SECRET_PATH):
        print(f"  GAGAL | secret webhook tidak ada di {SECRET_PATH}")
        return 1
    secret = open(SECRET_PATH).read().strip()

    rujukan = f"SP-9{random.randint(10, 99)}"
    txid = f"uji-rantai-{rujukan}"
    gagal = []

    print(f"  rujukan uji: {rujukan}")

    # 1. pesan
    kode, d = curl("/api/beli/kode", "POST", {"rujukan": rujukan})
    nominal = d.get("nominal")
    if kode != 200 or not nominal:
        print(f"  GAGAL | 1 pesan: HTTP {kode} {str(d)[:100]}")
        return 1
    print(f"  OK    | 1 pesan        : nominal {nominal}")

    # 2. bayar
    kode, d = curl("/api/payment-webhook", "POST",
                   {"amount": nominal, "status": "success", "txid": txid,
                    "rujukan": rujukan, "utm_source": "uji-rantai"},
                   {"X-Webhook-Secret": secret})
    if kode != 200:
        print(f"  GAGAL | 2 webhook      : HTTP {kode} {str(d)[:100]}")
        gagal.append("webhook")
    else:
        print("  OK    | 2 webhook      : diterima")

    time.sleep(3)

    # 3. status lunas
    kode, d = curl(f"/api/beli/status?rujukan={rujukan}")
    status = d.get("status")
    if status == "lunas":
        print("  OK    | 3 status       : lunas")
    else:
        print(f"  GAGAL | 3 status       : '{status}' (harus 'lunas')")
        gagal.append("status")

    # Kalau webhook ditolak, langkah 4-6 pasti ikut gagal karena datanya tidak ada.
    # Tetap dijalankan supaya laporan menunjukkan SEMUA sambungan yang putus, bukan
    # hanya yang pertama — tapi jangan hentikan skrip sebelum pembersihan.

    # 4. kode_terbit ditandai dibayar
    baris = d1(f"SELECT dibayar, asal FROM kode_terbit WHERE rujukan='{rujukan}'")
    if baris and baris[0].get("dibayar"):
        print(f"  OK    | 4 kode_terbit  : dibayar, asal '{baris[0].get('asal')}'")
    else:
        print(f"  GAGAL | 4 kode_terbit  : {baris}")
        gagal.append("kode_terbit")

    # 5. klaim
    kode, d = curl("/api/beli/kode", "POST", {"rujukan": rujukan})
    token = d.get("klaim_token")
    kode, d2 = curl("/api/beli/klaim", "POST", {"rujukan": rujukan, "klaim_token": token})
    if kode == 200 and d2.get("ok"):
        print(f"  OK    | 5 klaim        : {str(d2.get('pesan'))[:60]}")
    else:
        print(f"  GAGAL | 5 klaim        : HTTP {kode} {str(d2)[:100]}")
        gagal.append("klaim")

    # 6. referral terbit
    if d2.get("referensi"):
        print(f"  OK    | 6 referral     : {d2.get('referensi')}")
    else:
        print("  CATAT | 6 referral     : belum terbit (tidak selalu wajib)")

    # bersih-bersih
    if "--simpan" not in sys.argv:
        d1(f"DELETE FROM payments WHERE txid='{txid}'")
        d1(f"DELETE FROM kode_terbit WHERE rujukan='{rujukan}'")
        d1(f"DELETE FROM peristiwa WHERE rincian LIKE '%{rujukan}%'")
        sisa = d1("SELECT (SELECT COUNT(*) FROM payments WHERE txid LIKE 'uji-rantai-%') a, "
                  f"(SELECT COUNT(*) FROM kode_terbit WHERE rujukan='{rujukan}') b")
        print(f"  bersih         : {sisa}")

    return 0 if not gagal else 1


if __name__ == "__main__":
    sys.exit(main())

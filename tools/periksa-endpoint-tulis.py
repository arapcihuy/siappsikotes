#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Periksa endpoint tulis di API SiapPsikotes menolak permintaan tanpa kredensial.

MASALAH YANG DIJAGA (23 Okt 2026)
`POST /api/payment-webhook` menerima payload tanpa autentikasi apa pun, lalu:
  (a) menulis baris `payments` is_test=0 yang menaikkan revenue, dan
  (b) memanggil `aktifkanDariMuatanWebhook()` yang MENERBITKAN kode akses.

Dibuktikan langsung di produksi: `POST {"amount":39000,"status":"success","txid":"PALSU-OP-1"}`
menaikkan revenue Rp 39.000 -> Rp 78.000 tanpa kredensial. Artinya siapa pun bisa
mencetak uang di dashboard dan membuka akses gratis.

Sudah ditambal: header `X-Webhook-Secret` wajib, fail-closed (503 kalau secret belum
diset), perbandingan waktu-tetap. Endpoint menolak payload kosong dengan 401.

Uji ini menjaga agar tidak ada endpoint tulis yang kembali terbuka.

Pakai:
    python3 tools/periksa-endpoint-tulis.py                      # uji produksi
    python3 tools/periksa-endpoint-tulis.py --url http://127.0.0.1:8799
"""
import json
import sys
import urllib.error
import urllib.request

API = "https://siappsikotes-api.rasyidahmad180.workers.dev"

# Endpoint tulis yang WAJIB menolak permintaan tanpa kredensial.
# Nilai = daftar kode HTTP yang dianggap BENAR (menolak).
WAJIB_TOLAK = {
    "/api/payment-webhook": [401, 403, 503],
    "/api/tripay/webhook": [401, 403, 503],
    "/api/pembelian": [401, 403],
    "/api/profil": [401, 403],
    "/api/hapus-data-saya": [401, 403],
}

# Endpoint publik yang memang boleh menerima tanpa auth, TAPI tidak boleh menulis
# data bisnis. Diuji dengan payload kosong: harus 400 (ditolak validasi).
BOLEH_PUBLIK_TAPI_VALIDASI = {
    "/api/pantau": [400],
    "/api/beli/klaim": [400],
    "/api/beli/kode": [400],
}


def panggil(base, jalan, metode="POST", isi=None, headers=None):
    # WAJIB pakai curl, BUKAN urllib: Cloudflare memblokir User-Agent "Python-urllib"
    # dengan HTTP 403 "error code: 1010" SEBELUM request mencapai Worker. Uji berbasis
    # urllib karena itu melaporkan semua endpoint "ditolak" (false positive) — termasuk
    # endpoint yang sebenarnya terbuka.
    import subprocess

    data = json.dumps(isi if isi is not None else {})
    cmd = ["curl", "-sS", "-m", "25", "-X", metode, base + jalan,
           "-H", "content-type: application/json", "-d", data, "-w", "\n%{http_code}"]
    for k, v in (headers or {}).items():
        cmd += ["-H", f"{k}: {v}"]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=40)
    keluaran = (r.stdout or "") + (r.stderr or "")
    baris = keluaran.strip().split("\n")
    try:
        kode = int(baris[-1])
    except ValueError:
        return 0, keluaran[:120]
    return kode, "\n".join(baris[:-1])[:200]


def main():
    base = API
    if "--url" in sys.argv:
        base = sys.argv[sys.argv.index("--url") + 1]

    ok = True

    print("  -- endpoint yang WAJIB menolak tanpa kredensial --")
    for jalan, kode_sah in WAJIB_TOLAK.items():
        kode, isi = panggil(base, jalan)
        if kode in kode_sah:
            print(f"  OK    | {jalan:26} -> {kode} (ditolak)")
        else:
            print(f"  GAGAL | {jalan:26} -> {kode} (SEHARUSNYA {kode_sah}) {isi[:80]}")
            ok = False

    print("  -- endpoint publik: harus menolak payload kosong via validasi --")
    for jalan, kode_sah in BOLEH_PUBLIK_TAPI_VALIDASI.items():
        kode, isi = panggil(base, jalan)
        if kode in kode_sah:
            print(f"  OK    | {jalan:26} -> {kode} (ditolak validasi)")
        elif kode == 200:
            print(f"  GAGAL | {jalan:26} -> 200 MENERIMA payload kosong: {isi[:90]}")
            ok = False
        else:
            # 429 (rate limit) juga tanda endpoint aktif & waspada; bukan kegagalan.
            print(f"  CATAT | {jalan:26} -> {kode} {isi[:70]}")

    print("  -- webhook dengan secret SALAH harus ditolak --")
    for jalan in ("/api/payment-webhook", "/api/tripay/webhook"):
        kode, isi = panggil(base, jalan, isi={"amount": 99000, "status": "success", "txid": "PROBE-GATE"},
                           headers={"X-Webhook-Secret": "pasti-salah"})
        if kode in (401, 403, 503):
            print(f"  OK    | {jalan:26} -> {kode} (secret salah ditolak)")
        else:
            print(f"  GAGAL | {jalan:26} -> {kode} (secret salah DITERIMA) {isi[:80]}")
            ok = False

    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())

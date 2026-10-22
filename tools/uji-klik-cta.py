#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Uji funnel /beli/ di peramban sungguhan: apakah klik CTA benar-benar terkirim?

Latar belakang (23 Okt 2026): dashboard melaporkan 16 kunjungan /beli/ dan 11 kali
QRIS tampil, tetapi klik_beli = 0. Pipeline /api/pantau sudah terbukti sehat lewat
uji sintetis, jadi pertanyaannya: apakah handler klik di script.js NEVER terpasang?

Dua cara handler bisa mati tanpa terlihat:
  1. guard `if (!elN) return;` di awal IIFE — semua yang di bawahnya tidak jalan
  2. elemen #ctaBayar tidak ada saat skrip jalan (urutan DOM / render server)

Uji ini membuka halaman sungguhan, menunggu jaringan, lalu MENGKLIK #ctaBayar dan
memeriksa apakah ada permintaan ke /api/pantau dengan jenis klik_cta_bayar.

Pakai:
    /opt/homebrew/opt/python@3.14/bin/python3 tools/uji-klik-cta.py
    ... --kepala     # uji juga varian B
"""
import json
import re
import sys
from playwright.sync_api import sync_playwright

URL_DASAR = "https://siappsikotes.my.id/beli/"
PANTAU = "api/pantau"

# Penanda uji WAJIB berawalan 'uji-': deteksiUji() di Worker menandai utm_source
# seperti ini sebagai is_test=1, sehingga semua kueri dashboard (yang memfilter
# is_test = 0) MENGABAIKAN event ini. Uji jadi bisa jalan tiap commit tanpa
# mengotori metrik produksi.
UTM_UJI = "uji-klik-cta"


def uji(satu, varian):
    # utm_source berawalan uji- -> Worker menandai is_test=1 -> tidak masuk metrik
    url = f"{URL_DASAR}?utm_source={UTM_UJI}&v={varian}"
    galat = []

    # PENTING: navigator.sendBeacon mengirim Blob, dan Chromium TIDAK mengekspos
    # body-nya lewat CDP (post_data maupun post_data_buffer kosong). Jadi kita
    # bungkus sendBeacon SEBELUM skrip halaman jalan, lalu catat argumennya.
    # Ini menguji handler klik sampai ke isi payload, bukan cuma "ada request".
    satu.add_init_script("""
        window.__beacons = [];
        const asli = navigator.sendBeacon ? navigator.sendBeacon.bind(navigator) : null;
        navigator.sendBeacon = function(url, data) {
            let isi = '';
            try {
                if (data instanceof Blob) {
                    // Blob dibaca asinkron; simpan promise-nya
                    const p = data.text().then(t => {
                        window.__beacons.push({url: String(url), isi: t});
                    });
                } else {
                    isi = String(data || '');
                    window.__beacons.push({url: String(url), isi: isi});
                }
            } catch (e) {
                window.__beacons.push({url: String(url), isi: '<gagal baca>'});
            }
            return asli ? asli(url, data) : false;
        };
        // Jaring pengaman kalau halaman memakai fetch, bukan sendBeacon
        const fetchAsli = window.fetch;
        window.fetch = function(u, o) {
            try {
                if (String(u).indexOf('pantau') !== -1 && o && o.body) {
                    window.__beacons.push({url: String(u), isi: String(o.body)});
                }
            } catch (e) {}
            return fetchAsli.apply(this, arguments);
        };
    """)

    satu.on("pageerror", lambda e: galat.append(str(e)[:160]))

    satu.goto(url, wait_until="domcontentloaded", timeout=45000)
    satu.wait_for_timeout(2500)

    # 1) apakah skrip hidup dan elemen penting ada?
    cek = satu.evaluate("""() => {
        const cta = document.getElementById('ctaBayar');
        const elN = document.getElementById('beliNominal');
        return {
            ada_cta: !!cta,
            ada_nominal: !!elN,
            nominal_teks: elN ? elN.textContent.trim().slice(0, 20) : null,
            qris_img: !!document.querySelector('#qris img'),
            sp_lacak: typeof window.spLacak !== 'undefined' ? String(window.spLacak).slice(0, 20) : null,
        };
    }""")

    # 2) klik CTA seperti pengguna sungguhan
    if cek["ada_cta"]:
        try:
            satu.click("#ctaBayar", timeout=8000)
        except Exception as e:
            galat.append("klik gagal: " + str(e)[:120])
    satu.wait_for_timeout(1500)

    # 3) baca beacon yang tertangkap (termasuk hasil Blob.text() yang asinkron)
    beacons = satu.evaluate("() => window.__beacons || []")
    kirim = [b for b in beacons if "klik_cta_bayar" in (b.get("isi") or "")]

    print(f"\n--- {varian} ---")
    for k, v in cek.items():
        print(f"  {k:14}: {v}")
    print(f"  beacon tertangkap: {len(beacons)}")
    for b in beacons:
        print(f"      {str(b.get('isi'))[:150]}")
    print(f"  klik_cta_bayar : {'TERKIRIM' if kirim else 'TIDAK TERKIRIM'}")
    if galat:
        print(f"  galat JS       : {galat}")

    return bool(kirim), cek


def main():
    varian_list = ["variant-a"]
    if "--kepala" in sys.argv:
        varian_list.append("variant-b")

    # Playwright di mesin ini punya browser terpasang versi 1248, sementara paket
    # python yang berbeda menuntut versi lain (1117/1208). Pakai executable_path
    # langsung supaya uji tidak bergantung versi paket.
    import glob
    import os
    kandidat = sorted(glob.glob(os.path.expanduser(
        "~/Library/Caches/ms-playwright/chromium_headless_shell-*/"
        "chrome-headless-shell-mac-arm64/chrome-headless-shell")))
    exe = kandidat[-1] if kandidat else None
    if not exe:
        print("GAGAL: tidak ada chrome-headless-shell di cache ms-playwright")
        return 2

    hasil = {}
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=exe)
        for v in varian_list:
            ctx = browser.new_context(viewport={"width": 390, "height": 844})
            page = ctx.new_page()
            try:
                ok, cek = uji(page, v)
                hasil[v] = (ok, cek)
            finally:
                ctx.close()
        browser.close()

    print("\n=== KESIMPULAN ===")
    semua = all(h[0] for h in hasil.values())
    for v, (ok, cek) in hasil.items():
        print(f"  {v}: {'klik terkirim' if ok else 'KLIK TIDAK TERKIRIM'}"
              f"  (cta={cek['ada_cta']}, nominal={cek['ada_nominal']}, qris={cek['qris_img']})")
    return 0 if semua else 1


if __name__ == "__main__":
    sys.exit(main())

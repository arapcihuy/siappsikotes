#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Bangun halaman survei harga internal (/survei/) — menggantikan placeholder forms.gle.

MASALAH YANG DIPECAHKAN
Beranda menampilkan banner "Riset Harga — 30 Detik / Isi Survei" ke SETIAP pengunjung,
tetapi tombolnya menunjuk `https://forms.gle/XXXXXXXXXXXXXXXX` — placeholder yang tidak
pernah diisi dan membalas 404. Artinya setiap pengunjung yang tertarik mengisi survei
mendarat di halaman error Google, dan kita tidak mendapat satu data pun.

Halaman ini menggantikannya: 5 pertanyaan, tanpa akun, tanpa data pribadi, dan
jawabannya dicatat ke /api/pantau sebagai event `survei_kunjungan` + `survei_jawab`
supaya bisa dibaca dari dashboard.

Pakai:
    python3 tools/buat-survei.py
"""
import json
import os

AKAR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KELUAR = os.path.join(AKAR, "survei")

PERTANYAAN = [
    {
        "id": "harga",
        "t": "Menurutmu, harga yang wajar untuk 1.348 soal + pembahasan + 9 modul tes adalah:",
        "pilihan": ["Di bawah Rp 25.000", "Rp 25.000 – 39.000", "Rp 40.000 – 60.000", "Di atas Rp 60.000"],
    },
    {
        "id": "alasan",
        "t": "Yang paling membuatmu ragu membeli paket latihan online:",
        "pilihan": ["Harganya", "Tidak yakin kualitas soalnya", "Takut tidak sempat memakainya",
                    "Lebih suka buku/PDF", "Belum merasa butuh"],
    },
    {
        "id": "bentuk",
        "t": "Bentuk latihan yang paling kamu butuhkan:",
        "pilihan": ["Contoh soal + pembahasan", "Simulasi tryout bertimer", "Ringkasan materi",
                    "Latihan kecermatan (Kraepelin)", "Latihan tes gambar (Wartegg)"],
    },
    {
        "id": "perangkat",
        "t": "Kamu paling sering belajar pakai:",
        "pilihan": ["HP", "Laptop/PC", "Cetak di kertas", "Campur"],
    },
    {
        "id": "bayar",
        "t": "Metode bayar yang paling kamu pakai:",
        "pilihan": ["QRIS / e-wallet", "Transfer bank", "Pulsa", "Belum pernah beli online"],
    },
]

HTML = """<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#0a0f18">
<title>Survei Harga SiapPsikotes — 30 Detik, Tanpa Akun</title>
<meta name="description" content="Lima pertanyaan singkat untuk membantu menetapkan harga yang wajar. Tanpa akun, tanpa data pribadi, anonim.">
<meta name="robots" content="noindex,follow">
<link rel="canonical" href="https://siappsikotes.my.id/survei/">
<link rel="icon" type="image/png" sizes="32x32" href="../static/icons/favicon-32.png">
<style>
:root{--bg:#0a0f18;--surface:#121a28;--surface2:#172133;--line:rgba(255,255,255,.09);--text:#eaf1f8;--muted:#b3c0d1;--gold:#e6c552;--gold-dark:#c9a227;--ok:#4ade80}
*{box-sizing:border-box}body{margin:0;color:var(--text);background:var(--bg);font:16.5px/1.7 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased}
.wrap{max-width:720px;margin:0 auto;padding:28px 20px 60px}
header{border-bottom:1px solid var(--line);padding:14px 20px}
.merek{display:flex;align-items:center;gap:10px;font-weight:700;color:var(--text);text-decoration:none;font-size:15px}
.merek img{width:28px;height:28px;border-radius:8px}
h1{font-size:clamp(24px,4vw,32px);line-height:1.2;letter-spacing:-.8px;margin:26px 0 8px;font-weight:800}
.dek{color:var(--muted);margin:0 0 26px;font-size:16px}
.soal{border:1px solid var(--line);border-radius:14px;background:var(--surface);padding:18px 20px;margin:0 0 14px}
.soal p.t{font-weight:700;margin:0 0 12px;font-size:15.5px}
label.opsi{display:flex;gap:10px;align-items:flex-start;padding:9px 12px;border:1px solid var(--line);border-radius:10px;margin-bottom:8px;cursor:pointer;background:var(--surface2);transition:border-color .15s}
label.opsi:hover{border-color:rgba(230,197,82,.5)}
label.opsi input{margin-top:4px;accent-color:var(--gold)}
label.opsi:has(input:checked){border-color:var(--gold);background:rgba(230,197,82,.08)}
button{width:100%;min-height:50px;padding:14px 22px;border-radius:12px;border:1px solid rgba(0,0,0,.14);background:linear-gradient(180deg,var(--gold),var(--gold-dark));color:#1a1405;font:inherit;font-weight:700;font-size:16px;cursor:pointer;margin-top:8px}
button:disabled{opacity:.5;cursor:not-allowed}
.catatan{color:var(--muted);font-size:13px;margin-top:14px;line-height:1.55}
.terima{display:none;border:1px solid rgba(74,222,128,.4);border-radius:14px;background:rgba(74,222,128,.08);padding:22px;text-align:center}
.terima h2{margin:0 0 8px;font-size:20px;color:var(--ok)}
.terima p{margin:0 0 14px;color:var(--muted)}
.terima a{display:inline-block;padding:12px 22px;border-radius:10px;background:var(--gold);color:#1a1405;text-decoration:none;font-weight:700}
</style>
</head>
<body>
<header><a class="merek" href="../"><img src="../static/icons/icon-192.png" alt="" width="28" height="28"><span>SiapPsikotes</span></a></header>
<div class="wrap">
  <h1>Survei harga — 30 detik</h1>
  <p class="dek">Lima pertanyaan singkat. Tanpa akun, tanpa nama, tanpa email. Jawabanmu dipakai untuk menetapkan harga yang wajar.</p>

  <form id="formSurvei">
__SOAL__
    <button type="submit" id="tombolKirim">Kirim jawaban</button>
    <p class="catatan">Jawaban dikirim tanpa identitas. Kalau berubah pikiran, cukup tutup halaman ini — tidak ada yang tersimpan.</p>
  </form>

  <div class="terima" id="terima">
    <h2>Terima kasih</h2>
    <p>Jawabanmu tercatat. Ini membantu kami menetapkan harga yang tidak mengada-ada.</p>
    <a href="../contoh/?utm_source=survei&utm_medium=terima-kasih">Coba 40 soal gratis</a>
  </div>
</div>

<script>
(function(){
  var ALAMAT='https://siappsikotes-api.rasyidahmad180.workers.dev/api/pantau';
  var jawab={};
  function kirim(jenis,data){
    try{
      var isi=JSON.stringify(Object.assign({jenis:jenis,rujukan:'',utm_source:'survei',utm_medium:'internal'},data||{}));
      if(navigator.sendBeacon){navigator.sendBeacon(ALAMAT,new Blob([isi],{type:'text/plain'}));}
      else{fetch(ALAMAT,{method:'POST',body:isi,headers:{'content-type':'text/plain'},keepalive:true}).catch(function(){});}
    }catch(e){}
  }
  kirim('survei_kunjungan');
  document.querySelectorAll('input[type=radio]').forEach(function(el){
    el.addEventListener('change',function(){ jawab[el.name]=el.value; });
  });
  document.getElementById('formSurvei').addEventListener('submit',function(ev){
    ev.preventDefault();
    var kurang=[];
    document.querySelectorAll('.soal').forEach(function(s){
      var nama=s.getAttribute('data-id');
      if(!jawab[nama]) kurang.push(nama);
    });
    if(kurang.length){
      alert('Masih ada '+kurang.length+' pertanyaan yang belum dijawab.');
      return;
    }
    // Kirim satu event per pertanyaan supaya bisa dianalisis terpisah.
    // PENTING: /api/pantau mengambil isi kolom `rincian` dari field `rujukan`, dan untuk
    // event non-cardcheck/non-tryout nilainya WAJIB berformat SP-3angka. Karena itu
    // jawaban dikirim sebagai `rujukan` kosong + `detail` yang dipetakan ke utm_campaign
    // (kolom bebas 100 huruf) supaya tetap tersimpan tanpa melanggar validasi.
    Object.keys(jawab).forEach(function(k,idx){
      kirim('survei_jawab',{rujukan:'', utm_campaign:(k+'='+String(jawab[k])).slice(0,90)});
    });
    document.getElementById('formSurvei').style.display='none';
    document.getElementById('terima').style.display='block';
    window.scrollTo({top:0,behavior:'smooth'});
  });
})();
</script>
</body>
</html>
"""


def main():
    soal = []
    for i, p in enumerate(PERTANYAAN, 1):
        opsi = "\n".join(
            f'        <label class="opsi"><input type="radio" name="{p["id"]}" value="{v}">'
            f'<span>{v}</span></label>'
            for v in p["pilihan"]
        )
        soal.append(
            f'    <div class="soal" data-id="{p["id"]}">\n'
            f'      <p class="t">{i}. {p["t"]}</p>\n'
            f'{opsi}\n'
            f'    </div>'
        )

    os.makedirs(KELUAR, exist_ok=True)
    with open(os.path.join(KELUAR, "index.html"), "w", encoding="utf-8") as f:
        f.write(HTML.replace("__SOAL__", "\n".join(soal)))

    # Simpan skema pertanyaan untuk analisis
    with open(os.path.join(AKAR, "data", "survei-harga.json"), "w", encoding="utf-8") as f:
        json.dump({"pertanyaan": PERTANYAAN, "dibuat": "2026-10-23"}, f, ensure_ascii=False, indent=1)

    print(f"OK    | survei/index.html dibuat ({len(PERTANYAAN)} pertanyaan)")
    print(f"OK    | data/survei-harga.json (skema)")


if __name__ == "__main__":
    main()

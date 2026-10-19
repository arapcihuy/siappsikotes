import csv, json, random, urllib.request
WS = '/Users/mac/.hermes/kanban/workspaces/t_3aa8d57d'
rows = list(csv.DictReader(open('/Users/mac/.hermes/kanban/leads_v4.csv')))
tg   = [r for r in rows if r['reachable_channel']=='telegram']
em   = [r for r in rows if r['reachable_channel']=='email']
wa   = [r for r in rows if r['reachable_channel']=='wa']
# 100 leads: SEMUA telegram(86) + SEMUA email(8) + 6 wa = 100
sel_tg, sel_em, sel_wa = tg, em, wa[:6]
sel = sel_tg + sel_em + sel_wa
assert len(sel) == 100, len(sel)
random.seed(20261019)
# pemerataan varian per kanal: ambil komposisi kanal sama antara A dan B
by_ch = {}
for r in sel: by_ch.setdefault(r['reachable_channel'], []).append(r)
out, alloc = [], {}
for ch, L in by_ch.items():
    random.shuffle(L)
    for i, r in enumerate(L):
        v = 'abkopi_a' if i % 2 == 0 else 'abkopi_b'
        src = {'telegram':'telegram','email':'email','wa':'whatsapp'}[ch]
        url = (f"https://siappsikotes.my.id/beli/?v={v[-1]}"
               f"&utm_source={src}&utm_medium=broadcast"
               f"&utm_campaign={v}&utm_content={r['lead_id']}")
        deep = r['deep_link'] or ''
        out.append({'lead_id':r['lead_id'],'nama':r['nama'],'channel':ch,'target':r['chat_id'] or r['tele_username'] or r['email'],'variant':v[-1].upper(),'utm_url':url,'deep_link':deep})
for v in ('A','B'):
    alloc[v] = [o for o in out if o['variant']==v]
    print(v, len(alloc[v]), {c:sum(1 for o in alloc[v] if o['channel']==c) for c in by_ch})
with open(WS+'/broadcast_ab_plan.csv','w',newline='') as f:
    w=csv.DictWriter(f,fieldnames=['lead_id','nama','channel','target','variant','utm_url','deep_link']);w.writeheader();w.writerows(out)
# copy varian
COPY = {}
COPY['A'] = ("DUA JAM TERAKHIR — harga promo Rp 39.000 (asli Rp 59.000) tutup dan kembali normal.\n"
 "Bank soal SiapPsikotes: 1.300+ soal KRAE/TNI/POLRI/CPNS + pembahasan, langganan akses 30 hari, bayar QRIS.\n"
 "Jangan menunggu: {url}")
COPY['B'] = ("Coba dulu, baru putuskan. Saya buka 3 soal demo + latihan 10 menit gratis tanpa daftar:\n"
 "https://siappsikotes.my.id/latihan-psikotes-10-menit/\n"
 "Kalau skormu di latihan itu ternyata perlu pemantauan, ini paketnya: 1.300+ soal + pembahasan, Rp 39.000/30 hari ({url})")
json.dump(COPY, open(WS+'/copy_varian.json','w'), ensure_ascii=False, indent=1)
print('plan & copy tersimpan')

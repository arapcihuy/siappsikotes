#!/usr/bin/env python3
"""Monitoring kampanye A/B kopi broadcast (task t_3aa8d57d).

Membaca D1 siappsikotes-db (remote):
- peristiwa (jenis='beli:kunjungan_beli', utm_campaign='abkopi_a'/'abkopi_b')  -> klik
- payments (raw_payload mengandung utm_campaign abkopi_*)                      -> konversi
Tulis laporan ke abkopi_report.csv + abkopi_log.csv (append riwayat).
"""
import csv, json, os, subprocess, datetime
WS = os.path.dirname(os.path.abspath(__file__))
DB = 'siappsikotes-db'

def d1(sql):
    env = dict(os.environ, PATH='/Users/mac/.local/bin:/Users/mac/.nvm/versions/node/v22.22.0/bin:/usr/bin:/bin:/opt/homebrew/bin')
    p = subprocess.run(['/Users/mac/.local/bin/npx','wrangler','d1','execute',DB,'--remote','--json','--command',sql],
        capture_output=True, text=True, timeout=120,
        cwd=os.path.expanduser('~/tni-belajar/server'), env=env)
    if p.returncode != 0: raise RuntimeError('wrangler gagal: ' + (p.stderr or p.stdout)[-400:])
    return json.loads(p.stdout)[0]['results']

klik = {r['k']: int(r['n']) for r in d1("SELECT utm_campaign k, COUNT(*) n FROM peristiwa WHERE utm_campaign LIKE 'abkopi_%' AND jenis='beli:kunjungan_beli' GROUP BY utm_campaign")}
konv = {r['k']: int(r['n']) for r in d1("SELECT 'abkopi_' || lower(substr(json_extract(raw_payload,'$.utm_campaign'), -1)) k, COUNT(*) n FROM payments WHERE raw_payload LIKE '%abkopi_%' GROUP BY k")}
T0 = '2026-10-18T22:45:57'
rows_out, hist = [], []
for v in ('a','b'):
    k = 'abkopi_'+v
    n = klik.get(k,0); c = konv.get(k,0)
    rows_out.append({'variant':v.upper(),'utm_campaign':k,'klik_beli':n,'konversi':c,
                     'ctr_per_klik_pct':'' if n==0 else None,
                     'snapshot_at':datetime.datetime.now().isoformat()})
    hist.append({'ts':rows_out[-1]['snapshot_at'],'variant':v.upper(),'klik':n,'konversi':c})
snap = os.path.join(WS,'abkopi_report.csv')
with open(snap,'w',newline='') as f:
    w=csv.DictWriter(f,fieldnames=['variant','utm_campaign','klik_beli','konversi','ctr_per_klik_pct','snapshot_at']);w.writeheader();w.writerows(rows_out)
with open(os.path.join(WS,'abkopi_log.csv'),'a',newline='') as f:
    w=csv.DictWriter(f,fieldnames=['ts','variant','klik','konversi']);w.writeheader() if f.tell()==0 else None;w.writerows(hist)
print(json.dumps(rows_out,indent=1))

import csv, json, re, smtplib, subprocess, os, datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
WS = '/Users/mac/.hermes/kanban/workspaces/t_3aa8d57d'
COPY = json.load(open(WS+'/copy_varian.json'))
plan = list(csv.DictReader(open(WS+'/broadcast_ab_plan.csv')))
T0 = datetime.datetime.utcnow().isoformat()
env = {}
for line in open(os.path.expanduser('~/.hermes/.env')):
    m = re.match(r'\s*([A-Z0-9_]+)=(.*)\s*$', line)
    if m: env[m.group(1)] = m.group(2).strip().strip('"')
GH, GP = env['GMAIL_USER'], env['GMAIL_APP_PASSWORD']
log, sent_now = [], 0
srv = None
for r in plan:
    copy = COPY[r['variant']].format(url=r['utm_url'])
    status, ch, extra = '', r['channel'], ''
    if ch == 'telegram':
        ds = "  Deep link: " + r['deep_link'] + (" (klik ini, bot membalas teks lengkap)" if r['deep_link'] else "")
        status = 'deep_link_logged'
        msg_full = copy + ds
    elif ch == 'wa':
        status = 'wanot_allowed'; msg_full = copy
    elif ch == 'email':
        try:
            if srv is None:
                srv = smtplib.SMTP('smtp.gmail.com', 587, timeout=30)
                srv.starttls(); srv.login(GH, GP)
            m = MIMEMultipart('alternative')
            m['From'] = 'SiapPsikotes <%s>' % GH; m['To'] = r['target']
            m['Subject'] = ('[SiapPsikotes] Dua jam terakhir: Rp 39.000' if r['variant']=='A'
                            else '[SiapPsikotes] Coba latihan 10 menit ini, gratis')
            body_html = ('<div style="font-family:Arial,sans-serif;max-width:560px"><p>' +
                copy.replace('https://','https://').replace('\n','</p><p>') +
                '</p><p>Sistem: Anda menerima ini karena pernah berlangganan info latihan psikotes. '
                'Berhenti kirim: balas email ini dgn kata BERHENTI.</p></div>').replace('{url}',
                '<a href="%s">%s</a>' % (r['utm_url'], r['utm_url']))
            m.attach(MIMEText(copy.replace('{url}', r['utm_url'])*0 or copy.format(url=r['utm_url']), 'plain','utf-8'))
            m.attach(MIMEText(body_html, 'html', 'utf-8'))
            srv.sendmail(GH, [r['target']], m.as_string())
            status, extra = 'email_sent', 'sm=sent'
            sent_now += 1
        except Exception as e:
            status = 'email_failed'; extra = 'err=' + type(e).__name__
            if srv: 
                try: srv.quit()
                except Exception: pass
                srv = None
    log.append({'lead_id':r['lead_id'],'nama':r['nama'],'channel':ch,'variant':r['variant'],
                'utm_url':r['utm_url'],'deep_link':r['deep_link'],
                'message_preview':msg_full[:600],'sent_at':T0,'status':status,'note':extra})
    if len(msg_full) > 40000: pass
if srv:
    try: srv.quit()
    except Exception: pass
with open(WS+'/broadcast_ab_log.csv','w',newline='') as f:
    w=csv.DictWriter(f,fieldnames=['lead_id','nama','channel','variant','utm_url','deep_link','message_preview','sent_at','status','note']);w.writeheader();w.writerows(log)
import collections
print('T0=',T0); print(collections.Counter((r['channel'],r['status']) for r in log)); print('email sent:',sent_now)
json.dump({'t0_utc':T0,'campaign':'abkopi','abkopi_a':sum(1 for r in log if r['variant']=='A'),'abkopi_b':sum(1 for r in log if r['variant']=='B'),'total':len(log)}, open(WS+'/campaign_state.json','w'), indent=1)

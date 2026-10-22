// API SiapPsikotes — Cloudflare Worker + D1
//
// Prinsip keamanan yang dipegang di sini (menjawab kekhawatiran pemilik soal celah
// pada platform yang menyediakan API tabel otomatis):
//   1. TIDAK ADA API tabel otomatis. Setiap alamat ditulis tangan dan setiap permintaan
//      diperiksa sesinya lebih dulu. Tidak ada "SELECT *" yang bisa dipanggil siapa pun.
//   2. Setiap kueri memakai parameter terikat (prepared statement) - tidak ada penyusunan SQL
//      dari teks kiriman pengguna.
//   3. Token sesi hanya dikirim SEKALI saat masuk; yang disimpan di database hanya HASH-nya.
//   4. Identitas pengguna datang dari token Google yang DIPERIKSA di server: id_token diperiksa
//      tanda tangannya (RS256 terhadap kunci publik Google, plus aud/iss/exp), dan access_token
//      ditukar langsung ke Google lewat API userinfo. Klaim surel dari peramban tidak pernah dipercaya.
//   5. CORS dibatasi ke alamat situs kita saja (bukan *).
//   6. Pemilik (rasyidahmad180@gmail.com) boleh membaca ringkasan semua pengguna; pengguna
//      biasa hanya bisa membaca datanya sendiri - dan itu ditegakkan di setiap kueri.

const SITUS = ['https://siappsikotes.my.id', 'https://www.siappsikotes.my.id',
  'https://arapcihuy.github.io', 'http://localhost:8000', 'http://127.0.0.1:8000',
  'https://cardcheck-siapp.pages.dev'];
const CLIENT_ID = '1093622424912-nmkq3j5boa6tgf834qp6903i8vnet14a.apps.googleusercontent.com';
const PEMILIK = ['rasyidahmad180@gmail.com'];
const KUNCI_GOOGLE_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const BATAS_ISI = 200000;   // batas ukuran isi per kiriman (bahan belajar)
const UMUR_SESI = 60 * 60 * 24 * 30; // 30 hari

let kunciGoogle = { waktu: 0, daftar: null };

function cors(asal) {
  const ok = SITUS.indexOf(asal) !== -1;
  return {
    'Access-Control-Allow-Origin': ok ? asal : SITUS[0],
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function jawab(data, status, asal) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, cors(asal))
  });
}

function dasar64urlKeBytes(s) {
  s = String(s).replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const biner = atob(s);
  const out = new Uint8Array(biner.length);
  for (let i = 0; i < biner.length; i++) out[i] = biner.charCodeAt(i);
  return out;
}

function teksKeBase64url(buf) {
  const b = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256hex(teks) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(teks));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function ambilKunciGoogle() {
  const kini = Date.now();
  if (kunciGoogle.daftar && kini - kunciGoogle.waktu < 3600000) return kunciGoogle.daftar;
  const r = await fetch(KUNCI_GOOGLE_URL);
  if (!r.ok) throw new Error('tidak bisa mengambil kunci Google');
  const j = await r.json();
  kunciGoogle = { waktu: kini, daftar: j.keys || [] };
  return kunciGoogle.daftar;
}

// Memeriksa token Google: tanda tangan RS256, penerbit, audiens (client id kita), dan masa berlaku.
async function periksaTokenGoogle(idToken) {
  const bagian = String(idToken || '').split('.');
  if (bagian.length !== 3) throw new Error('token tidak berbentuk JWT');
  const kepala = JSON.parse(new TextDecoder().decode(dasar64urlKeBytes(bagian[0])));
  const isi = JSON.parse(new TextDecoder().decode(dasar64urlKeBytes(bagian[1])));
  const kunci = (await ambilKunciGoogle()).find(k => k.kid === kepala.kid);
  if (!kunci) throw new Error('kunci Google tidak dikenal (kid)');
  const kunciImpor = await crypto.subtle.importKey('jwk', kunci, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const sah = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', kunciImpor, dasar64urlKeBytes(bagian[2]),
    new TextEncoder().encode(bagian[0] + '.' + bagian[1]));
  if (!sah) throw new Error('tanda tangan token tidak sah');
  if (isi.aud !== CLIENT_ID) throw new Error('token bukan untuk aplikasi ini');
  if (isi.iss !== 'accounts.google.com' && isi.iss !== 'https://accounts.google.com') throw new Error('penerbit token tidak sah');
  if (typeof isi.exp !== 'number' || isi.exp * 1000 < Date.now()) throw new Error('token sudah kedaluwarsa');
  if (typeof isi.email !== 'string' || !isi.email) throw new Error('token tidak memuat surel');
  if (isi.email_verified === false) throw new Error('surel Google belum terverifikasi');
  return { id: String(isi.sub), surel: String(isi.email).toLowerCase(), nama: isi.name || '', foto: isi.picture || '' };
}

// Memeriksa access_token Google dengan MENANYAKAN langsung ke Google (tokeninfo).
// Peramban yang tidak mengirim id_token (mis. Safari pada alur token GIS) tetap bisa
// menyambung ruang akunnya dengan cara ini, TAPI tokennya harus benar-benar milik aplikasi
// ini: tokeninfo mengembalikan audiens (client id) dan lingkup, jadi token dari aplikasi
// Google lain - walau sah untuk akunnya - ditolak di sini. Klaim dari peramban tidak dipercaya.
async function periksaTokenAksesGoogle(accessToken) {
  const t = String(accessToken || '').trim();
  if (t.length < 10) throw new Error('token akses kosong');
  const r = await fetch('https://oauth2.googleapis.com/tokeninfo?access_token=' + encodeURIComponent(t));
  if (!r.ok) throw new Error('token akses tidak sah');
  const p = await r.json();
  if (p.aud !== CLIENT_ID) throw new Error('token bukan untuk aplikasi ini');
  if (String(p.scope || '').indexOf('email') === -1) throw new Error('lingkup token tidak memuat surel');
  if (typeof p.email !== 'string' || !p.email) throw new Error('token tidak memuat surel');
  if (p.email_verified === false) throw new Error('surel Google belum terverifikasi');
  if (!p.sub) throw new Error('token tidak memuat id akun');
  return { id: String(p.sub), surel: String(p.email).toLowerCase(), nama: p.name || '', foto: p.picture || '' };
}

// Pembatas laju: menahan percobaan beruntun (pengintaian, brute force, penyalahgunaan).
// Disimpan di database supaya berlaku lintas-instance (Worker tidak menyimpan keadaan).
async function batasiLaju(env, ip, alamat, batas, jendelaDetik) {
  const jendela = String(Math.floor(Date.now() / (jendelaDetik * 1000)));
  const kunci = alamat + '|' + ip + '|' + jendela;
  await env.DB.prepare('INSERT INTO batas (kunci, jumlah) VALUES (?, 1) ON CONFLICT(kunci) DO UPDATE SET jumlah = batas.jumlah + 1').bind(kunci).run();
  const baris = await env.DB.prepare('SELECT jumlah FROM batas WHERE kunci = ?').bind(kunci).first();
  const jumlah = (baris && baris.jumlah) || 1;
  return { boleh: jumlah <= batas, jumlah, batas };
}

// Flag data uji (t_549faa07): utm uji-/probe/audit/verify-task/test atau flag eksplisit
// berarti baris itu tidak dihitung di metrik revenue/konversi — dipakai semua jalur tulis.
function deteksiUji(sumber, eksplisit) {
  if (eksplisit) return 1;
  const src = String(sumber || '').toLowerCase();
  const markers = ['uji-', 'probe', 'audit', 'verify-task', 'test'];
  return markers.some(m => src.startsWith(m)) ? 1 : 0;
}

// Id kunjungan anonim 8 hex: satu-satunya pengikat antara baris kunjungan /beli/
// yang direkam SERVER (rincian 'id:xxxx|var:a' — rujukan SP belum ada saat halaman
// dibuka) dan beacon client yang membawa rujukan ('SP-123|var:a|id:xxxx').
function idLacakBaru() {
  const byte = new Uint8Array(4);
  crypto.getRandomValues(byte);
  return Array.from(byte).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Sidik kode akses — HARUS sama dengan sidikKode di static/js/fitur11.js dan tools/buat-kode.py.
const KUNCI_KODE = ['siap', 'psikotes', '2026', 'kode'].join('|');
function sidikKode(data) {
  let h = 2166136261;
  const s = String(data) + '#' + KUNCI_KODE;
  for (let i = 0; i < s.length; i++) {
    h = h ^ s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  const pos = h % 1679616;                // 36^4
  const abjad = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let hasil = '';
  let p = pos;
  while (p > 0) { hasil = abjad.charAt(p % 36) + hasil; p = Math.floor(p / 36); }
  while (hasil.length < 4) hasil = '0' + hasil;
  return hasil;
}

// Penanda hash untuk tabel kode_terbit. Kode mentah tidak pernah disimpan.
async function hashKodeTerbit(kode) {
  return await sha256hex('kodet:' + String(kode).toUpperCase());
}

// Mencari catatan terbit sebuah kode. null = kode tidak pernah diterbitkan pemilik.
async function kodeTerbit(env, kode) {
  const hash = await hashKodeTerbit(kode);
  return await env.DB.prepare(
    'SELECT kode_hash, kode_akhir, terbit, dibayar, rujukan, nominal FROM kode_terbit WHERE kode_hash = ?'
  ).bind(hash).first();
}

// ===== Pemesanan & verifikasi otomatis pembayaran QRIS =====
// Harga dasar paket premium. Nominal unik = HARGA_DASAR + 3 digit rujukan (SP-123 -> 39123),
// rumus yang sama dengan beli/script.js — dipakai mencocokkan pembayaran ke pesanan.
const HARGA_DASAR = 39000;

function nominalDariRujukan(rujukan) {
  const m = /^SP-(\d{3})$/.exec(String(rujukan));
  return m ? HARGA_DASAR + parseInt(m[1], 10) : 0;
}

// Kode akses pembeli diturunkan DETERMINISTIK dari rujukan — rumus yang sama dengan
// kodeUntukNomor() di beli/script.js: isi = 'P' + 'SP123' -> 'PSP123', kode = 'SP' + isi + sidik.
// Satu rujukan selalu menghasilkan kode yang sama di semua klik & perangkat, sehingga baris
// kode_terbit bisa dibuat sekali dan dipakai ulang (idempoten).
function kodeDariRujukan(rujukan) {
  const isi = 'P' + String(rujukan).toUpperCase().replace(/[^0-9A-Z]/g, '');
  return 'SP' + isi + sidikKode(isi);
}

// ===== Program referensi: 1 pembeli 1 kode REF-XXXX (keputusan FINAL marketing) =====
// Pembayaran sukses -> kode unik `REF-XXXX` (4 karakter alfanumerik) di tabel
// referral_kode, tampil di halaman sukses bayar. Teman yang beli lewat
// siappsikotes.my.id/referensi/REF-XXXX mendapat diskon Rp 5.000 (Rp 34.000);
// referrer mendapat +30 hari akses, maksimal 10 klaim/bulan/kode.
const HARGA_REF = 34000;                                  // 39.000 - diskon 5.000
const POLA_REF = /^REF-[0-9A-Z]{4}$/;
const ABJAD_REF = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';      // tanpa 0/O/1/I/L
const BATAS_KLAIM_BULANAN = 10;

function nominalDasar(refKode) {
  return POLA_REF.test(String(refKode || '')) ? HARGA_REF : HARGA_DASAR;
}

// Nominal yang diharapkan untuk satu rujukan: nominal pesanan yang sudah tercatat
// (mungkin sudah kena diskon referensi), jatuh ke rumus dasar bila pesanan belum ada.
async function nominalDiharapkan(env, rujukan) {
  const baris = await env.DB.prepare('SELECT nominal, ref_kode FROM kode_terbit WHERE kode_hash = ?')
    .bind(await hashKodeTerbit(kodeDariRujukan(rujukan))).first();
  if (baris && baris.nominal) return { nominal: Number(baris.nominal) || 0, ref_kode: baris.ref_kode || null };
  return { nominal: nominalDariRujukan(rujukan), ref_kode: null };
}

// Terbitkan kode referensi unik untuk satu pembayaran sukses (idempoten per rujukan).
// Dipanggil di setiap jalur pembayaran aktif (Tripay PAID, klaim, webhook success).
async function terbitkanKodeRef(env, rujukan) {
  if (!rujukan) return null;
  const ada = await env.DB.prepare('SELECT kode FROM referral_kode WHERE payment_id = ?').bind(rujukan).first();
  if (ada) return ada.kode;
  for (let coba = 0; coba < 8; coba++) {
    const b = crypto.getRandomValues(new Uint8Array(4));
    let akhiran = '';
    for (let i = 0; i < b.length; i++) akhiran += ABJAD_REF.charAt(b[i] % ABJAD_REF.length);
    const kandidat = 'REF-' + akhiran;
    try {
      await env.DB.prepare('INSERT INTO referral_kode (kode, payment_id, dibuat_at) VALUES (?, ?, ?)')
        .bind(kandidat, rujukan, new Date().toISOString()).run();
      return kandidat;
    } catch (e) { /* kode sudah dipakai orang lain: coba karakter acak lain */ }
  }
  return null;
}

// Reward referrer: +30 hari setelah pembayaran sukses lewat kodenya.
// Anti-abuse sesuai keputusan FINAL: maks 10 klaim/bulan/kode, dan kode yang lahir
// dari pesanan yang sama (pembeli = referrer) tidak memberi reward.
// akses_hingga diperpanjang bila sudah ditetapkan; akses tanpa batas tetap tanpa batas
// (semua pembeli saat ini) — reward tetap tercatat di reward_hari & referral_konversi.
async function beriRewardRef(env, refKode, rujukanPembeli, nominal) {
  if (!POLA_REF.test(String(refKode || ''))) return null;
  const kini = new Date().toISOString();
  const bulan = kini.slice(0, 7);
  const kode = await env.DB.prepare('SELECT kode, payment_id FROM referral_kode WHERE kode = ?').bind(refKode).first();
  if (!kode || kode.payment_id === rujukanPembeli) return null;
  const hitung = await env.DB.prepare(
    "SELECT klaim_bulan, klaim_bulan_ini, reward_hari FROM referral_kode WHERE kode = ?"
  ).bind(refKode).first();
  const bulanIni = hitung.klaim_bulan === bulan ? (Number(hitung.klaim_bulan_ini) || 0) : 0;
  if (bulanIni >= BATAS_KLAIM_BULANAN) return null;
  await env.DB.prepare('UPDATE referral_kode SET klaim_bulan_ini = ?, klaim_bulan = ?, reward_hari = reward_hari + 30 WHERE kode = ?')
    .bind(bulanIni + 1, bulan, refKode).run();
  await env.DB.prepare("INSERT INTO referral_konversi (kode, pembayaran_baru, waktu, status, nominal) VALUES (?, ?, ?, 'reward', ?)")
    .bind(refKode, rujukanPembeli, kini, nominal).run();
  const hashRef = await hashKodeTerbit(kodeDariRujukan(kode.payment_id));
  await env.DB.prepare(
    "UPDATE kode_terbit SET akses_hingga = strftime('%Y-%m-%dT%H:%M:%SZ', akses_hingga, '+30 days') " +
    "WHERE kode_hash = ? AND akses_hingga IS NOT NULL"
  ).bind(hashRef).run();
  await env.DB.prepare('INSERT INTO peristiwa (pengguna, jenis, rincian, waktu) VALUES (?, ?, ?, ?)')
    .bind(null, 'referensi_reward', refKode + '|' + rujukanPembeli + '|' + (nominal || 0), kini).run();
  return { kode: refKode, klaim_bulan_ini: bulanIni + 1 };
}

// Validasi kode referensi untuk endpoint publik (redirect & cek diskon di /beli/).
async function kodeRefValid(env, kode) {
  if (!POLA_REF.test(String(kode || ''))) return false;
  const ada = await env.DB.prepare('SELECT kode FROM referral_kode WHERE kode = ?').bind(kode).first();
  return !!ada;
}

// Status pesanan menurut baris kode_terbit: dibayar NULL = menunggu_bayar; terisi = lunas
// bila asal-nya sudah terverifikasi webhook ('tripay', 'klaim-webhook', 'webhook-auto'),
// menunggu_verifikasi bila asal 'klaim' (klaim "sudah bayar" yang belum ketemu muatan
// pembayaran masuk — dicocokkan otomatis: instan saat tekan, cron */10 (t_3a03d4b4),
// dan cron rekonsiliasi 08:00 yang menaikkan asal ke 'klaim-cron' saat cocok).
const ASAL_LUNAS = ['tripay', 'klaim-webhook', 'webhook-auto', 'klaim-cron'];
function statusPesanan(baris) {
  if (!baris) return 'tidak_ada';
  if (!baris.dibayar) return 'menunggu_bayar';
  return ASAL_LUNAS.indexOf(baris.asal) !== -1 ? 'lunas' : 'menunggu_verifikasi';
}

// ===== Pencocokan klaim/pesanan <-> muatan webhook masuk (fallback tanpa Tripay) =====
// Satu nomor nominal pasangan itu berkata dua kali: dasar harga (39/34/29 ribu) plus 3 angka
// rujukan, dan angka itulah yang pembeli bayarkan. Jadi satu baris muatan webhook (kolom
// nominal + jam) sudah cukup untuk mengidentifikasi pesanannya — mirip kode rujukan-nya.
// Jendela waktu: pembayaran tidak bisa lebih dari 5 menit SEBELUM rujukan terbit (tidak
// mungkin bayar sebelum tahu nominal), dan tak lewat dari 48 jam sesudahnya — lebih dari
// itu gugur ke verifikasi manual pemilik.
async function cariBayarCocok(env, nominal, terbit) {
  try {
    const jumlah = Math.round(Number(nominal) || 0);
    if (!jumlah || !terbit) return null;
    const t0 = new Date(terbit).getTime();
    if (!isFinite(t0)) return null;
    const hasil = await env.DB.prepare(
      "SELECT id, timestamp, amount, txid, rujukan, is_test FROM payments " +
      "WHERE status IN ('success','paid') AND amount = ? AND timestamp >= ? AND timestamp <= ? " +
      "ORDER BY id ASC LIMIT 1"
    ).bind(jumlah, new Date(t0 - 5 * 60e3).toISOString(), new Date(t0 + 48 * 3600e3).toISOString()).all();
    return (hasil.results && hasil.results[0]) || null;
  } catch (e) { return null; }
}

// Klaim/pesanan asal 'klaim' yang ketemu muatannya: naik ke 'klaim-webhook' (lunas) + catat.
async function tandaKlaimCocok(env, pesanan, bayar, kini) {
  await env.DB.prepare("UPDATE kode_terbit SET asal = 'klaim-webhook' WHERE kode_hash = ? AND asal = 'klaim'")
    .bind(pesanan.kode_hash).run();
  await env.DB.prepare('INSERT INTO peristiwa (pengguna, jenis, rincian, waktu, is_test) VALUES (?, ?, ?, ?, ?)')
    .bind(null, 'beli:match_webhook', pesanan.rujukan + '|' + bayar.amount + '|pay:' + bayar.id + '|' + (bayar.txid || ''), kini, bayar.is_test || 0).run();
}

// Muatan webhook yang masuk mencari pesanannya sendiri, dua arah:
//  - klaim 'sudah bayar' yang masih menunggu_verifikasi -> klaim-webhook (lunas);
//  - pesanan belum dibayar sama sekali (pembeli lupa menekan klaim) -> webhook-auto (lunas),
//    tetapi hanya bila muatan itu TULIS rujukannya atau pesanan satu-satunya dengan nominal
//    itu — dua pesanan tanpa nama tidak boleh ditebak dari satu nomor saja.
async function aktifkanDariMuatanWebhook(env, bayar) {
  try {
    const jumlah = Math.round(Number(bayar.amount) || 0);
    if (!jumlah) return;
    const kini = new Date().toISOString();
    const klaim = await env.DB.prepare(
      "SELECT kode_hash, rujukan, terbit, nominal FROM kode_terbit WHERE nominal = ? AND asal = 'klaim' AND dibayar IS NOT NULL LIMIT 5"
    ).bind(jumlah).all();
    for (const p of (klaim.results || [])) {
      // Jendela waktu juga disaring di sini (cariBayarCocok), muatannya harus pas jendelanya.
      const cocok = await cariBayarCocok(env, p.nominal, p.terbit);
      if (!cocok || String(cocok.id) !== String(bayar.id)) continue;
      await tandaKlaimCocok(env, p, cocok, kini);
    }
    if (bayar.rujukan && /^SP-\d{3}$/.test(bayar.rujukan)) {
      const pesanan = await env.DB.prepare(
        "SELECT kode_hash, rujukan, terbit, nominal, dibayar, asal FROM kode_terbit WHERE nominal = ? AND dibayar IS NULL AND rujukan = ? LIMIT 1"
      ).bind(jumlah, bayar.rujukan).first();
      if (pesanan && pesanan.terbit) {
        const t0 = new Date(pesanan.terbit).getTime();
        if (isFinite(t0) && new Date(bayar.timestamp).getTime() >= t0 - 5 * 60e3) {
          await env.DB.prepare("UPDATE kode_terbit SET dibayar = ?, asal = 'webhook-auto' WHERE kode_hash = ? AND dibayar IS NULL")
            .bind(bayar.timestamp, pesanan.kode_hash).run();
          await env.DB.prepare('INSERT INTO peristiwa (pengguna, jenis, rincian, waktu, is_test) VALUES (?, ?, ?, ?, ?)')
            .bind(null, 'beli:match_webhook', pesanan.rujukan + '|' + jumlah + '|pay:' + bayar.id + '|' + (bayar.txid || ''), kini, bayar.is_test || 0).run();
          await terbitkanKodeRef(env, pesanan.rujukan);
        }
      }
    } else {
      // Muatan tanpa nama: aktif bila TEPAT satu pesanan belum dibayar memakai nominal itu.
      const tanpaNama = await env.DB.prepare(
        "SELECT kode_hash, rujukan, terbit FROM kode_terbit WHERE nominal = ? AND dibayar IS NULL LIMIT 2"
      ).bind(jumlah).all();
      const satu = (tanpaNama.results || [])[0];
      if (satu && (tanpaNama.results || []).length === 1 && satu.terbit) {
        const t0 = new Date(satu.terbit).getTime();
        if (isFinite(t0) && new Date(bayar.timestamp).getTime() >= t0 - 5 * 60e3) {
          await env.DB.prepare("UPDATE kode_terbit SET dibayar = ?, asal = 'webhook-auto' WHERE kode_hash = ? AND dibayar IS NULL")
            .bind(bayar.timestamp, satu.kode_hash).run();
          await env.DB.prepare('INSERT INTO peristiwa (pengguna, jenis, rincian, waktu, is_test) VALUES (?, ?, ?, ?, ?)')
            .bind(null, 'beli:match_webhook', satu.rujukan + '|' + jumlah + '|pay:' + bayar.id + '|' + (bayar.txid || ''), kini, bayar.is_test || 0).run();
          await terbitkanKodeRef(env, satu.rujukan);
        }
      }
    }
  } catch (e) {}
}

// Cron */10: klaim "sudah bayar" yang masih menunggu_verifikasi dicocokkan ulang dengan
// muatan webhook yang mungkin masuk belakangan — janji "aktif maksimal 15 menit"
// (t_3a03d4b4) dipegang cukup oleh pencocokan klaim saat tekan + cron ini.
async function selesaikanKlaimTertunda(env) {
  try {
    const ada = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM kode_terbit WHERE asal = 'klaim' AND dibayar IS NOT NULL AND terbit >= ?"
    ).bind(new Date(Date.now() - 72 * 3600e3).toISOString()).first();
    if (!ada || !ada.n) return 0;
    const kini = new Date().toISOString();
    const baris = await env.DB.prepare(
      "SELECT kode_hash, rujukan, terbit, nominal FROM kode_terbit WHERE asal = 'klaim' AND dibayar IS NOT NULL AND terbit >= ? LIMIT 100"
    ).bind(new Date(Date.now() - 72 * 3600e3).toISOString()).all();
    let lulus = 0;
    for (const p of (baris.results || [])) {
      const cocok = await cariBayarCocok(env, p.nominal, p.terbit);
      if (!cocok) continue;
      await tandaKlaimCocok(env, p, cocok, kini);
      lulus++;
    }
    return lulus;
  } catch (e) { return 0; }
}

// Auto-terbit kode saat rekonsiliasi menemukan klaim yang cocok pembayaran NYATA
// (is_test=0). Dua jalur:
//  - jalur A 'rujukan': muatan menyebut rujukan yang SAMA dan nominal sama (terkuat);
//  - jalur B 'nominal': nominal sama dan muatan TEPAT SATU dalam jendela ±12 jam
//    sekitar jam klaim — menutup kasus muatan tanpa nama yang nominalnya unik.
// Baris dinaikkan ke asal 'klaim-cron' (anggota ASAL_LUNAS; skema 'klaim-webhook'/
// 'webhook-auto' milik pencocokan webhook t_3a03d4b4 tidak disentuh) + terbitkanKodeRef.
// Muatan yang sudah terpakai satu klaim tidak boleh diambil klaim lain dalam satu run.
async function autoTerbitkanKlaimCocok(env) {
  try {
    const klaim = await env.DB.prepare(
      "SELECT kode_hash, rujukan, terbit, dibayar, nominal FROM kode_terbit " +
      "WHERE asal = 'klaim' AND dibayar IS NOT NULL AND dibayar >= ? ORDER BY dibayar DESC LIMIT 100"
    ).bind(new Date(Date.now() - 14 * 864e5).toISOString()).all();
    const baris = klaim.results || [];
    if (!baris.length) return 0;
    // Klaim uji (peristiwa beli:klaim_bayar is_test=1) TIDAK boleh naik: probe QA
    // tidak mencerminkan uang nyata, dan muatan asli tidak mencemari data uji.
    const peristiwa = await env.DB.prepare(
      "SELECT rincian, is_test FROM peristiwa WHERE jenis = 'beli:klaim_bayar' AND waktu >= ? LIMIT 1000"
    ).bind(new Date(Date.now() - 14 * 864e5).toISOString()).all();
    const ujiRujukan = {};
    for (const u of (peristiwa.results || [])) {
      const rj = String(u.rincian || '').split('|')[0].toUpperCase();
      if (rj && Number(u.is_test) === 1) ujiRujukan[rj] = true;
    }
    const terpakai = {};
    const kini = new Date().toISOString();
    let naik = 0;
    for (const p of baris) {
      const jumlah = Math.round(Number(p.nominal) || 0);
      if (!jumlah || !p.dibayar || !p.terbit) continue;
      if (ujiRujukan[String(p.rujukan).toUpperCase()]) continue;   // klaim uji: tidak naik
      // Muatan tidak mungkin lebih lama dari 5 menit SEBELUM rujukan terbit.
      let bayar = null, jalur = '';
      const tepat = await env.DB.prepare(
        "SELECT id, timestamp, amount, txid, is_test FROM payments " +
        "WHERE status IN ('success','paid') AND is_test = 0 AND rujukan = ? AND amount = ? " +
        "AND timestamp >= ? LIMIT 1"
      ).bind(p.rujukan, jumlah, new Date(new Date(p.terbit).getTime() - 5 * 60e3).toISOString()).all();
      const a = (tepat.results || [])[0];
      if (a && !terpakai[String(a.id)]) { bayar = a; jalur = 'rujukan'; }
      if (!bayar) {
        const rentang = await env.DB.prepare(
          "SELECT id, timestamp, amount, txid, is_test FROM payments " +
          "WHERE status IN ('success','paid') AND is_test = 0 AND amount = ? " +
          "AND timestamp >= ? AND timestamp <= ? ORDER BY id ASC LIMIT 5"
        ).bind(jumlah,
          new Date(new Date(p.dibayar).getTime() - 12 * 3600e3).toISOString(),
          new Date(new Date(p.dibayar).getTime() + 12 * 3600e3).toISOString()).all();
        const kandidat = (rentang.results || []).filter(x => !terpakai[String(x.id)]);
        // Ambigu (>=2 kandidat) = verifikasi manual pemilik, bukan tebakan otomatis.
        if (kandidat.length === 1) { bayar = kandidat[0]; jalur = 'nominal'; }
      }
      if (!bayar) continue;
      terpakai[String(bayar.id)] = true;
      await env.DB.prepare("UPDATE kode_terbit SET asal = 'klaim-cron' WHERE kode_hash = ? AND asal = 'klaim'")
        .bind(p.kode_hash).run();
      await env.DB.prepare('INSERT INTO peristiwa (pengguna, jenis, rincian, waktu, is_test) VALUES (?, ?, ?, ?, ?)')
        .bind(null, 'beli:match_cron',
          p.rujukan + '|' + bayar.amount + '|pay:' + bayar.id + '|jalur:' + jalur + '|' + (bayar.txid || ''),
          kini, 0).run();
      await terbitkanKodeRef(env, p.rujukan);
      naik++;
    }
    return naik;
  } catch (e) { console.error('AUTO-TB-ERROR:', e.message); return -1; }
}

function hexKeBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

async function hmacHex(kunci, teks) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(String(kunci)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const tanda = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(String(teks)));
  return Array.from(new Uint8Array(tanda)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Token klaim "saya sudah bayar" (jalur interim B): payload + HMAC-SHA256. Diterbitkan server
// saat pesanan dibuat, dibalas pembeli lewat tombol klaim. Kuncinya hanya ada di Worker
// (wrangler secret KLAIM_HMAC_SECRET), jadi orang luar tidak bisa memalsukan token.
async function buatTokenKlaim(env, isi) {
  const payload = JSON.stringify(Object.assign({ waktu: Date.now() }, isi));
  const tanda = await hmacHex(env.KLAIM_HMAC_SECRET, payload);
  const tubuh = teksKeBase64url(new TextEncoder().encode(payload).buffer);
  return tubuh + '.' + tanda;
}

// Mengembalikan payload token bila HMAC-nya sah (perbandingan constant-time), selain itu null.
async function periksaTokenKlaim(env, token) {
  try {
    const [tubuh, tanda] = String(token || '').split('.');
    if (!tubuh || !tanda || !env.KLAIM_HMAC_SECRET) return null;
    const biner = dasar64urlKeBytes(tubuh);
    const payload = JSON.parse(new TextDecoder().decode(biner));
    const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.KLAIM_HMAC_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const sah = await crypto.subtle.verify('HMAC', k, hexKeBytes(tanda), biner);
    return sah ? payload : null;
  } catch (e) { return null; }
}

// Isi kode baru: penanda tanggal + 12 huruf acak dari abjad tanpa karakter mudah tertukar
// (tidak ada 0/O/1/I/L). Sidik 4 huruf dihitung di server dengan sidikKode.
function isiKodeBaru() {
  const teks = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  const b = crypto.getRandomValues(new Uint8Array(12));
  let acak = '';
  for (let i = 0; i < b.length; i++) acak += teks.charAt(b[i] % teks.length);
  return new Date().toISOString().slice(2, 10).replace(/-/g, '') + acak;
}

// Membuka sesi baru: token dikirim ke klien, yang disimpan di database hanya hash-nya.
async function bukaSesi(env, penggunaId, kini) {
  const token = teksKeBase64url(crypto.getRandomValues(new Uint8Array(32))) + '.' + teksKeBase64url(crypto.getRandomValues(new Uint8Array(16)));
  const hash = await sha256hex(token);
  const kedaluwarsa = new Date(Date.now() + UMUR_SESI * 1000).toISOString();
  await env.DB.prepare('INSERT INTO sesi (token_hash, pengguna, dibuat, kedaluwarsa) VALUES (?, ?, ?, ?)')
    .bind(hash, penggunaId, kini, kedaluwarsa).run();
  // Hapus sesi paling lama bila melebihi 5, dan bersihkan sesi kedaluwarsa.
  await env.DB.prepare(
    'DELETE FROM sesi WHERE pengguna = ? AND token_hash NOT IN (SELECT token_hash FROM sesi WHERE pengguna = ? ORDER BY dibuat DESC LIMIT 5)'
  ).bind(penggunaId, penggunaId).run();
  await env.DB.prepare('DELETE FROM sesi WHERE kedaluwarsa < ?').bind(kini).run();
  return token;
}

function adalahPemilik(pengguna) {
  return PEMILIK.indexOf(pengguna.surel) !== -1;
}

async function sesiDariPermintaan(request, env) {
  const h = request.headers.get('Authorization') || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const hash = await sha256hex(m[1].trim());
  const baris = await env.DB.prepare('SELECT pengguna, kedaluwarsa FROM sesi WHERE token_hash = ?').bind(hash).first();
  if (!baris) return null;
  if (baris.kedaluwarsa < new Date().toISOString()) return null;
  const p = await env.DB.prepare('SELECT id, surel, nama, jalur, target_tanggal FROM pengguna WHERE id = ?').bind(baris.pengguna).first();
  return p || null;
}

function angka(n, batas) {
  const v = parseInt(n, 10);
  if (!isFinite(v) || v < 0) return 0;
  return Math.min(v, batas || 1000000);
}

// ==================== A/B halaman /beli/ (spesifikasi-ab-beli.md) ====================
// Assignment server-side via cookie sp_beli_var; halaman statis Pages tidak diubah isinya.
const ASAL_BELI_HTML = 'https://raw.githubusercontent.com/arapcihuy/siappsikotes/master/beli/index.html';

// Anchor = string persis di beli/index.html master. Kalau master berubah bentuk,
// rewrite tidak terjadi (halaman kontrol tampil apa adanya) — update anchor mengikuti master.

// Tembolok master HTML 120 detik dalam isolat: fetch GitHub raw kadang lambat (>1 s)
// dan itu langsung jadi TTFB halaman /beli/ di mobile (target: QRIS <2 detik). Rewrite
// A/B tetap per permintaan, dijalankan di atas salinan tembolok. Master baru di repo
// live maksimal 120 detik kemudian; master rusak (anchor hilang) tidak pernah disimpan.
let beliHtmlCache = '', beliHtmlWaktu = 0;
async function masterBeliHtml() {
  const kini = Date.now();
  if (beliHtmlCache && kini - beliHtmlWaktu < 120000) return beliHtmlCache;
  const res = await fetch(ASAL_BELI_HTML, { headers: { 'User-Agent': 'siappsikotes-api', 'Accept': 'text/html' } });
  if (!res.ok) throw new Error('master tidak terjangkau');
  const html = await res.text();
  if (html.indexOf('id="ctaBayar"') === -1) throw new Error('master berubah bentuk');
  beliHtmlCache = html; beliHtmlWaktu = kini;
  return html;
}
const ANCHOR_BELI = {
  lencana: '<span class="lencana">Harga standar A/B test</span>',
  h1: '<h1 class="h-harga">Beli akses penuh &mdash; <span id="displayHarga">Rp 39.000</span> sekali bayar</h1>',
  dek: '<p class="dek">Satu pembayaran membuka 1.348 soal beserta pembahasannya, semua modul tes, dan Laporan Lengkap.\n      Bukan langganan, tanpa perpanjangan otomatis.</p>',
  cta: '<a class="tombol" href="#bayar" id="ctaBayar">Bayar Rp 39.000 dengan QRIS</a>'
};

// Copy final 2 varian (produkt-norman, final — tidak boleh diganti selama eksperimen).
// Harga Rp 39.000 wajib tampil di CTA kedua varian; angka 1.348/9 modul = bank soal.
const COPY_BELI = {
  a: {
    lencana: '<span class="lencana">Kode aktif setelah dicek otomatis</span>',
    h1: '<h1 class="h-harga">Bayar QRIS &rarr; kode akses aktif setelah dicek</h1>',
    dek: '<p class="dek">Tanpa kirim bukti transfer: pembayaranmu dicek otomatis dari catatan QRIS &mdash; begitu tercocok, kode akses aktif di halaman ini maksimal 15 menit. Sekali bayar Rp 39.000, bukan langganan: 1.348 soal, 9 modul tes, dan Laporan Lengkap.</p>',
    cta: '<a class="tombol" href="#bayar" id="ctaBayar">Bayar QRIS Rp 39.000 &mdash; kode aktif setelah dicek</a>'
  },
  b: {
    lencana: '<span class="lencana">1.348 soal + pembahasan tiap soal</span>',
    h1: '<h1 class="h-harga">1.348 soal berpola tes kedinasan, semua dikupas tuntas</h1>',
    dek: '<p class="dek">Latihan dari soal berpola tes kerja &amp; kedinasan &mdash; HGT, KSO, AKS, hingga wawancara &mdash; dan tiap soal sudah dikupas langkah demi langkah di pembahasannya. Sekali bayar Rp 39.000, bukan langganan.</p>',
    cta: '<a class="tombol" href="#bayar" id="ctaBayar">Kupas 1.348 soal &mdash; Rp 39.000 sekali bayar</a>'
  }
};

function varianDariCookie(request) {
  const cocok = /(?:^|;\s*)sp_beli_var=([ab])/.exec(request.headers.get('Cookie') || '');
  return cocok ? cocok[1] : '';
}

async function layaniBeliAb(request, url, env, ctx) {
  // 1) Assignment (urutan wajib): utm_source=variant-a|variant-b menang & cookie mengikuti;
  //    lalu cookie sp_beli_var; terakhir random 50/50 (cookie di-set).
  const dariUrl = ({ 'variant-a': 'a', 'variant-b': 'b' })[url.searchParams.get('utm_source')] || '';
  let varian = dariUrl || varianDariCookie(request);
  const setCookie = varian ? !!dariUrl : true;   // dari URL atau random baru -> Set-Cookie
  if (!varian) varian = Math.random() < 0.5 ? 'a' : 'b';

  // 2) HTML origin statis (master = sumber deploy Pages). Origin gagal -> pass-through
  //    Pages apa adanya (fail-open — halaman beli tidak pernah diblok).
  let html = '';
  try { html = await masterBeliHtml(); } catch (e) { html = ''; }
  if (!html) {
    return fetch('https://siappsikotes.my.id' + url.pathname + (url.search || ''), { headers: { 'Accept': 'text/html' } });
  }

  // 3) Rewrite 4 elemen + inject varian & id kunjungan untuk beacon (dibaca beli/script.js).
  //    Harga tidak pernah disentuh: string 'Rp 39.000' tetap tampil & angkanya utuh.
  const salin = COPY_BELI[varian];
  const idKunjungan = idLacakBaru();
  html = html.replace(ANCHOR_BELI.lencana, salin.lencana)
             .replace(ANCHOR_BELI.h1, salin.h1)
             .replace(ANCHOR_BELI.dek, salin.dek)
             .replace(ANCHOR_BELI.cta, salin.cta)
             .replace('<script src="script.js"',
                      '<script>window.spBeliVar="' + varian + '";window.spLacak="' + idKunjungan + '";</script><script src="script.js"');

  const header = {
    'Content-Type': 'text/html; charset=utf-8',
    // WAJIB override max-age=600 GitHub/CF — satu varian tidak boleh ter-cache untuk semua.
    'Cache-Control': 'private, no-store'
  };
  if (setCookie) {
    header['Set-Cookie'] = 'sp_beli_var=' + varian + '; Max-Age=2592000; Path=/; SameSite=Lax; Secure';
  }

  // 4) Kunjungan /beli/ tercatat SERVER-SIDE (t_eece4f7e): tidak bergantung beacon client
  //    (penghadang iklan/MathJax JS mati tidak boleh menelan penghitungan visit).
  //    UTM dari URL halaman, varian dari assignment server. Dilempar via ctx.waitUntil
  //    supaya respons page tidak menunggu tulisan D1.
  if (env && env.DB) {
    const utmServer = {
      s: String(url.searchParams.get('utm_source') || '').slice(0, 50),
      m: String(url.searchParams.get('utm_medium') || '').slice(0, 50),
      c: String(url.searchParams.get('utm_campaign') || '').slice(0, 100)
    };
    const ip = request.headers.get('CF-Connecting-IP') || 'tanpa-ip';
    const envAb = env, idSrv = idKunjungan;
    if (ctx && ctx.waitUntil) {
      ctx.waitUntil((async () => {
        try {
          const laju = await batasiLaju(envAb, ip, 'kunjungan_server', 30, 60); // maksimal 30 pageview/menit/IP
          if (!laju.boleh) return;
          await envAb.DB.prepare('INSERT INTO peristiwa (pengguna, jenis, rincian, waktu, utm_source, utm_medium, utm_campaign, is_test) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
            .bind(null, 'beli:kunjungan_server', 'id:' + idSrv + '|var:' + varian, new Date().toISOString(),
                  utmServer.s, utmServer.m, utmServer.c,
                  deteksiUji(utmServer.s) || deteksiUji(utmServer.c)).run();
        } catch (e) { /* gagal catat kunjungan tidak boleh menahan halaman */ }
      })());
    }
  }
  return new Response(html, { status: 200, headers: header });
}

export default {
  async fetch(request, env, ctx) {
    const asal = request.headers.get('Origin') || '';
    const url = new URL(request.url);
    const jalan = url.pathname.replace(/\/+$/, '') || '/';

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(asal) });
    if (asal && SITUS.indexOf(asal) === -1) return jawab({ pesan: 'asal tidak diizinkan' }, 403, asal);

    try {
      // ---- program referensi: /referensi/:kode -> validasi D1 -> redirect /beli/ ----
      // Kode valid  : 302 /beli/?ref=REF-XXXX (diskon Rp 5.000 diterapkan saat checkout).
      // Kode tak ada / salah bentuk: 302 /beli/ tanpa diskon. Halaman landing program
      // (/referensi/draft) dilempar apa adanya ke origin statis.
      if (jalan === '/referensi/draft') {
        return fetch('https://siappsikotes.my.id/referensi/draft/', { headers: { 'Accept': 'text/html' } });
      }
      if (jalan.indexOf('/referensi/') === 0) {
        const kode = jalan.slice('/referensi/'.length).toUpperCase();
        const tujuan = (await kodeRefValid(env, kode)) ? '/beli/?ref=' + kode : '/beli/';
        return Response.redirect('https://siappsikotes.my.id' + tujuan, 302);
      }

      // ---- A/B /beli/: dokumen HTML di-swap per varian; aset /beli* lain pass-through ----
      if (jalan === '/beli' || jalan === '/beli/index.html') {
        return layaniBeliAb(request, url, env, ctx);
      }
      if (jalan.indexOf('/beli/') === 0) {
        return fetch('https://siappsikotes.my.id' + url.pathname + (url.search || ''), { headers: { 'Accept': '*/*' } });
      }
      // ---- cek kode referensi (publik, dipakai /beli/ sebelum menampilkan harga diskon) ----
      if (jalan === '/api/referensi/cek' && request.method === 'GET') {
        const kode = (url.searchParams.get('kode') || '').toUpperCase().trim();
        return jawab({ ok: true, sah: await kodeRefValid(env, kode), kode: POLA_REF.test(kode) ? kode : null }, 200, asal);
      }

      // ---- masuk: tukar token Google (id_token atau access_token) dengan sesi kita ----
      if (jalan === '/api/masuk' && request.method === 'POST') {
        const ip = request.headers.get('CF-Connecting-IP') || 'tanpa-ip';
        const laju = await batasiLaju(env, ip, 'masuk', 10, 60);   // maksimal 10 kali per menit per IP
        if (!laju.boleh) return jawab({ pesan: 'terlalu banyak percobaan, coba lagi nanti' }, 429, asal);
        const badan = await request.json().catch(() => ({}));
        // id_token (JWT) bila ada; kalau tidak, access_token ditukar ke Google (userinfo).
        const orang = badan.id_token ? await periksaTokenGoogle(badan.id_token)
                                     : await periksaTokenAksesGoogle(badan.access_token);
        const kini = new Date().toISOString();
        await env.DB.prepare(
          'INSERT INTO pengguna (id, surel, nama, foto, dibuat, terakhir_aktif) VALUES (?, ?, ?, ?, ?, ?) ' +
          'ON CONFLICT(id) DO UPDATE SET surel = excluded.surel, nama = excluded.nama, foto = excluded.foto, terakhir_aktif = excluded.terakhir_aktif'
        ).bind(orang.id, orang.surel, orang.nama, orang.foto, kini, kini).run();

        const token = await bukaSesi(env, orang.id, kini);
        await env.DB.prepare('INSERT INTO peristiwa (pengguna, jenis, rincian, waktu) VALUES (?, ?, ?, ?)')
          .bind(orang.id, 'masuk', orang.surel, kini).run();

        return jawab({ token, pengguna: { id: orang.id, surel: orang.surel, nama: orang.nama, pemilik: adalahPemilik(orang) } }, 200, asal);
      }

      // ---- masuk dengan kode akses: satu ruang progres per kode (tanpa akun Google) ----
      // Id ruang = turunan SHA-256 dari kode (kode mentah tidak dipakai sebagai id); kode
      // dicatat di kolom surel sebagai penanda supaya pemilik bisa mengenali ruang per kode.
      if (jalan === '/api/ruang/masuk' && request.method === 'POST') {
        const ip = request.headers.get('CF-Connecting-IP') || 'tanpa-ip';
        const laju = await batasiLaju(env, ip, 'ruang', 20, 60);   // maksimal 20 kali per menit per IP
        if (!laju.boleh) return jawab({ pesan: 'terlalu banyak percobaan, coba lagi nanti' }, 429, asal);
        const badan = await request.json().catch(() => ({}));
        const kode = String(badan.kode || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (kode.indexOf('SP') !== 0 || kode.length < 8 || kode.length > 44) {
          return jawab({ pesan: 'kode tidak dikenali' }, 400, asal);
        }
        const isi = kode.slice(2, kode.length - 4);
        if (sidikKode(isi) !== kode.slice(-4)) return jawab({ pesan: 'kode tidak cocok' }, 400, asal);
        // Gerbang sebenarnya: kode harus TERBIT di catatan server. Sidik di atas hanya
        // menyaring salah tulis; kuncinya ikut terkirim ke peramban, jadi sidik yang benar
        // bukan bukti pembayaran. Tanpa baris di kode_terbit, kode buatan sendiri tidak
        // membuka apa pun walau sidiknya cocok.
        const terbit = await kodeTerbit(env, kode);
        if (!terbit) return jawab({ pesan: 'kode tidak terdaftar' }, 400, asal);
        if (!terbit.dibayar) return jawab({ pesan: 'kode belum tercatat lunas' }, 400, asal);
        const id = 'kode:' + (await sha256hex(kode)).slice(0, 40);
        const kini = new Date().toISOString();
        await env.DB.prepare(
          'INSERT INTO pengguna (id, surel, nama, foto, dibuat, terakhir_aktif) VALUES (?, ?, ?, ?, ?, ?) ' +
          'ON CONFLICT(id) DO UPDATE SET terakhir_aktif = excluded.terakhir_aktif'
        ).bind(id, 'kode:' + kode, 'Pengguna kode', '', kini, kini).run();
        const token = await bukaSesi(env, id, kini);
        await env.DB.prepare('INSERT INTO peristiwa (pengguna, jenis, rincian, waktu) VALUES (?, ?, ?, ?)')
          .bind(id, 'ruang', kode.slice(-6), kini).run();
        return jawab({ token, pengguna: { id, surel: 'kode:' + kode, nama: 'Pengguna kode', pemilik: false } }, 200, asal);
      }

      // ---- keluar: cabut sesi ini (dan sesi lama yang menumpuk) ----
      if (jalan === '/api/keluar' && request.method === 'POST') {
        const h = request.headers.get('Authorization') || '';
        const m = h.match(/^Bearer\s+(.+)$/i);
        if (m) {
          const hash = await sha256hex(m[1].trim());
          await env.DB.prepare('DELETE FROM sesi WHERE token_hash = ?').bind(hash).run();
        }
        return jawab({ ok: true, pesan: 'sesi dicabut' }, 200, asal);
      }

      const saya = await sesiDariPermintaan(request, env);
      const perluMasuk = () => jawab({ pesan: 'perlu masuk' }, 401, asal);

      // Setiap penulisan dibatasi lajunya per pengguna (maksimal 120 per menit).
      if (request.method === 'POST' && saya && jalan !== '/api/keluar') {
        const laju = await batasiLaju(env, String(saya.id), 'tulis', 120, 60);
        if (!laju.boleh) return jawab({ pesan: 'terlalu cepat, coba lagi sebentar' }, 429, asal);
      }

      // ---- keadaan saya (progres + bahan + pembelian) ----
      if (jalan === '/api/saya' && request.method === 'GET') {
        if (!saya) return perluMasuk();
        const [prog, sal, bah, bel, pengguna] = await Promise.all([
          env.DB.prepare('SELECT kategori, benar, salah, terakhir FROM progres WHERE pengguna = ?').bind(saya.id).all(),
          env.DB.prepare('SELECT id_soal, kategori, jumlah, terakhir FROM salah WHERE pengguna = ?').bind(saya.id).all(),
          env.DB.prepare('SELECT jenis, kunci, isi, diperbarui FROM bahan WHERE pengguna = ?').bind(saya.id).all(),
          env.DB.prepare('SELECT kode, rujukan, nominal, tanggal FROM pembelian WHERE pengguna = ?').bind(saya.id).all(),
          env.DB.prepare('SELECT jalur, target_tanggal, terakhir_aktif FROM pengguna WHERE id = ?').bind(saya.id).first()
        ]);
        return jawab({
          pengguna: { id: saya.id, surel: saya.surel, nama: saya.nama, pemilik: adalahPemilik(saya) },
          profil: pengguna || {},
          progres: prog.results || [], salah: sal.results || [],
          bahan: bah.results || [], pembelian: bel.results || []
        }, 200, asal);
      }

      // ---- simpan progres satu kategori ----
      if (jalan === '/api/progres' && request.method === 'POST') {
        if (!saya) return perluMasuk();
        const b = await request.json().catch(() => ({}));
        const kategori = String(b.kategori || '').slice(0, 60);
        if (!kategori) return jawab({ pesan: 'kategori wajib' }, 400, asal);
        const kini = new Date().toISOString();
        await env.DB.prepare(
          'INSERT INTO progres (pengguna, kategori, benar, salah, terakhir) VALUES (?, ?, ?, ?, ?) ' +
          'ON CONFLICT(pengguna, kategori) DO UPDATE SET benar = excluded.benar, salah = excluded.salah, terakhir = excluded.terakhir'
        ).bind(saya.id, kategori, angka(b.benar), angka(b.salah), kini).run();
        await env.DB.prepare('UPDATE pengguna SET terakhir_aktif = ? WHERE id = ?').bind(kini, saya.id).run();
        return jawab({ ok: true }, 200, asal);
      }

      // ---- catat satu soal yang perlu diulang ----
      if (jalan === '/api/salah' && request.method === 'POST') {
        if (!saya) return perluMasuk();
        const b = await request.json().catch(() => ({}));
        const idSoal = String(b.id_soal || '').slice(0, 80);
        if (!idSoal) return jawab({ pesan: 'id_soal wajib' }, 400, asal);
        const kini = new Date().toISOString();
        await env.DB.prepare(
          'INSERT INTO salah (pengguna, id_soal, kategori, jumlah, terakhir) VALUES (?, ?, ?, 1, ?) ' +
          'ON CONFLICT(pengguna, id_soal) DO UPDATE SET jumlah = salah.jumlah + 1, terakhir = excluded.terakhir'
        ).bind(saya.id, idSoal, String(b.kategori || '').slice(0, 60), kini).run();
        await env.DB.prepare('UPDATE pengguna SET terakhir_aktif = ? WHERE id = ?').bind(kini, saya.id).run();
        return jawab({ ok: true }, 200, asal);
      }

      // ---- simpan bahan belajar (jenis + kunci) ----
      if (jalan === '/api/bahan' && request.method === 'POST') {
        if (!saya) return perluMasuk();
        const b = await request.json().catch(() => ({}));
        const jenis = String(b.jenis || '').slice(0, 40);
        const kunci = String(b.kunci || '').slice(0, 80);
        const isi = typeof b.isi === 'string' ? b.isi : JSON.stringify(b.isi || null);
        if (!jenis || !kunci) return jawab({ pesan: 'jenis dan kunci wajib' }, 400, asal);
        if (isi.length > BATAS_ISI) return jawab({ pesan: 'isi terlalu besar' }, 413, asal);
        const kini = new Date().toISOString();
        await env.DB.prepare(
          'INSERT INTO bahan (pengguna, jenis, kunci, isi, diperbarui) VALUES (?, ?, ?, ?, ?) ' +
          'ON CONFLICT(pengguna, jenis, kunci) DO UPDATE SET isi = excluded.isi, diperbarui = excluded.diperbarui'
        ).bind(saya.id, jenis, kunci, isi, kini).run();
        return jawab({ ok: true }, 200, asal);
      }

      // ---- hapus satu bahan belajar ----
      if (jalan === '/api/bahan/hapus' && request.method === 'POST') {
        if (!saya) return perluMasuk();
        const b = await request.json().catch(() => ({}));
        const kunci = String(b.kunci || '').slice(0, 80);
        if (!kunci) return jawab({ pesan: 'kunci wajib' }, 400, asal);
        await env.DB.prepare('DELETE FROM bahan WHERE pengguna = ? AND kunci = ?').bind(saya.id, kunci).run();
        return jawab({ ok: true }, 200, asal);
      }

      // ---- hapus semua bahan belajar ----
      if (jalan === '/api/bahan/semua/hapus' && request.method === 'POST') {
        if (!saya) return perluMasuk();
        await env.DB.prepare('DELETE FROM bahan WHERE pengguna = ?').bind(saya.id).run();
        return jawab({ ok: true }, 200, asal);
      }

      // ---- simpan pembelian (kode akses) agar tidak hilang saat ganti perangkat ----
      // Nominal TIDAK diambil dari kiriman peramban (dulu bisa: pembeli mana pun bisa
      // menulis nominal berapa saja). Yang dicatat adalah nominal pada catatan setoran
      // server; kode yang tidak terbit juga ditolak di sini.
      if (jalan === '/api/pembelian' && request.method === 'POST') {
        if (!saya) return perluMasuk();
        const b = await request.json().catch(() => ({}));
        const kode = String(b.kode || '').toUpperCase().slice(0, 40);
        if (!kode) return jawab({ pesan: 'kode wajib' }, 400, asal);
        const terbit = await kodeTerbit(env, kode);
        if (!terbit || !terbit.dibayar) return jawab({ pesan: 'kode tidak terdaftar' }, 400, asal);
        const kini = new Date().toISOString();
        await env.DB.prepare(
          'INSERT INTO pembelian (pengguna, kode, rujukan, nominal, tanggal) VALUES (?, ?, ?, ?, ?) ' +
          'ON CONFLICT(pengguna, kode) DO UPDATE SET rujukan = excluded.rujukan, nominal = excluded.nominal'
        ).bind(saya.id, kode, String(terbit.rujukan || '').slice(0, 20), Number(terbit.nominal) || 0, kini).run();
        await env.DB.prepare('INSERT INTO peristiwa (pengguna, jenis, rincian, waktu) VALUES (?, ?, ?, ?)')
          .bind(saya.id, 'pembelian', kode, kini).run();
        return jawab({ ok: true }, 200, asal);
      }

      // ---- simpan profil (jalur & target) ----
      if (jalan === '/api/profil' && request.method === 'POST') {
        if (!saya) return perluMasuk();
        const b = await request.json().catch(() => ({}));
        await env.DB.prepare('UPDATE pengguna SET jalur = ?, target_tanggal = ?, terakhir_aktif = ? WHERE id = ?')
          .bind(String(b.jalur || '').slice(0, 40), String(b.target_tanggal || '').slice(0, 10), new Date().toISOString(), saya.id).run();
        return jawab({ ok: true }, 200, asal);
      }

      // ---- hapus seluruh data saya (hak pengguna, UU 27/2022) ----
      if (jalan === '/api/hapus-data-saya' && request.method === 'POST') {
        if (!saya) return perluMasuk();
        // Ditulis satu per satu (tanpa menyusun SQL dari rangkaian teks) supaya tidak ada
        // pola berbahaya sama sekali, walau nama tabelnya berasal dari daftar tetap.
        await env.DB.prepare('DELETE FROM progres WHERE pengguna = ?').bind(saya.id).run();
        await env.DB.prepare('DELETE FROM salah WHERE pengguna = ?').bind(saya.id).run();
        await env.DB.prepare('DELETE FROM bahan WHERE pengguna = ?').bind(saya.id).run();
        await env.DB.prepare('DELETE FROM pembelian WHERE pengguna = ?').bind(saya.id).run();
        await env.DB.prepare('DELETE FROM sesi WHERE pengguna = ?').bind(saya.id).run();
        await env.DB.prepare('DELETE FROM pengguna WHERE id = ?').bind(saya.id).run();
        return jawab({ ok: true, pesan: 'seluruh data kamu sudah dihapus' }, 200, asal);
      }

      // ---- unduh seluruh data saya (hak pengguna) ----
      if (jalan === '/api/unduh-data-saya' && request.method === 'GET') {
        if (!saya) return perluMasuk();
        const [prog, sal, bah, bel] = await Promise.all([
          env.DB.prepare('SELECT kategori, benar, salah, terakhir FROM progres WHERE pengguna = ?').bind(saya.id).all(),
          env.DB.prepare('SELECT id_soal, kategori, jumlah, terakhir FROM salah WHERE pengguna = ?').bind(saya.id).all(),
          env.DB.prepare('SELECT jenis, kunci, isi, diperbarui FROM bahan WHERE pengguna = ?').bind(saya.id).all(),
          env.DB.prepare('SELECT kode, rujukan, nominal, tanggal FROM pembelian WHERE pengguna = ?').bind(saya.id).all()
        ]);
        return jawab({ pengguna: { surel: saya.surel, nama: saya.nama }, progres: prog.results,
                       salah: sal.results, bahan: bah.results, pembelian: bel.results }, 200, asal);
      }

      // ---- dasbor pemilik (hanya akun pemilik) ----
      if (jalan === '/api/pemilik/ringkasan' && request.method === 'GET') {
        if (!saya) return perluMasuk();
        if (!adalahPemilik(saya)) return jawab({ pesan: 'bukan pemilik' }, 403, asal);
        const jumlah = await env.DB.prepare('SELECT COUNT(*) AS n FROM pengguna').first();
        const hariIni = new Date().toISOString().slice(0, 10);
        const aktifHariIni = await env.DB.prepare("SELECT COUNT(*) AS n FROM pengguna WHERE substr(terakhir_aktif,1,10) = ?").bind(hariIni).first();
        const daftar = await env.DB.prepare(
          'SELECT p.surel, p.nama, p.jalur, p.terakhir_aktif, ' +
          '(SELECT COALESCE(SUM(benar),0) FROM progres WHERE pengguna = p.id) AS total_benar, ' +
          '(SELECT COALESCE(SUM(salah),0) FROM progres WHERE pengguna = p.id) AS total_salah, ' +
          '(SELECT COUNT(*) FROM pembelian WHERE pengguna = p.id) AS jumlah_pembelian ' +
          'FROM pengguna p ORDER BY p.terakhir_aktif DESC LIMIT 200'
        ).all();
        return jawab({ total_pengguna: jumlah.n, aktif_hari_ini: aktifHariIni.n, pengguna: daftar.results || [] }, 200, asal);
      }

      // ---- pemilik: terbitkan kode akses dari catatan setoran (hanya akun pemilik) ----
      // Satu-satunya jalur yang membuat kode berlaku. Nominal & rujukan = catatan setoran
      // yang pemilik pegang (nomor transfer/QRIS), bukan angka dari peramban pembeli.
      // Kodenya dibuat di server; isi yang dipilih sendiri oleh pemilik tidak diterima
      // supaya kode tidak bisa disamakan dengan pesanan yang belum dibayar.
      if (jalan === '/api/pemilik/kode-terbit' && request.method === 'POST') {
        if (!saya) return perluMasuk();
        if (!adalahPemilik(saya)) return jawab({ pesan: 'bukan pemilik' }, 403, asal);
        const b = await request.json().catch(() => ({}));
        const nominal = Math.round(Number(b.nominal));
        const rujukan = String(b.rujukan || '').trim().slice(0, 40);
        const jumlah = Math.min(Math.max(parseInt(b.jumlah, 10) || 1, 1), 50);
        if (!isFinite(nominal) || nominal <= 0) return jawab({ pesan: 'nominal setoran wajib' }, 400, asal);
        if (!rujukan) return jawab({ pesan: 'rujukan setoran wajib' }, 400, asal);
        const kini = new Date().toISOString();
        const kode = [];
        for (let i = 0; i < jumlah; i++) {
          let k = '', isi = '', coba = 0;
          do {
            isi = isiKodeBaru();
            k = 'SP' + isi + sidikKode(isi);
            coba++;
          } while (coba < 8 && await kodeTerbit(env, k));
          // terbit + dibayar diisi bersama: setoran sudah dicatat sebelum kode dibuat.
          await env.DB.prepare(
            'INSERT INTO kode_terbit (kode_hash, kode_akhir, terbit, dibayar, rujukan, nominal, asal) VALUES (?, ?, ?, ?, ?, ?, ?)'
          ).bind(await hashKodeTerbit(k), k.slice(-6), kini, kini, rujukan, nominal, 'pemilik').run();
          kode.push(k);
        }
        await env.DB.prepare('INSERT INTO peristiwa (pengguna, jenis, rincian, waktu) VALUES (?, ?, ?, ?)')
          .bind(saya.id, 'kode-terbit', rujukan + '|' + nominal + '|' + kode.length, kini).run();
        return jawab({ ok: true, kode, rujukan, nominal }, 200, asal);
      }

      // ---- pemilik: daftar kode terbit (tanpa kode mentahnya) ----
            // ---- pelacakan funnel pembelian (tanpa login). Event dikirim dari beli/index.html ----
            // Hanya nama event yang dikenal yang dicatat, dan tanpa data pribadi: IP tidak disimpan
            // (hanya dipakai untuk pembatas laju), rincian = rujukan SP-3angka yang pembeli memang
            // sudah membuat sendiri di perangkatnya.
            // UTM params (utm_source, utm_medium, utm_campaign) dikirim opsional dari klien
            // untuk atribusi kampanye broadcast.
            if (jalan === '/api/pantau' && request.method === 'POST') {
              const ip = request.headers.get('CF-Connecting-IP') || 'tanpa-ip';
              const laju = await batasiLaju(env, ip, 'pantau', 60, 60); // maksimal 60 event per menit per IP
              if (!laju.boleh) return jawab({ pesan: 'terlalu sering' }, 429, asal);
              const b = await request.json().catch(() => ({}));
              const JENIS_PANTAU = ['kunjungan_beli', 'klik_cta_bayar', 'salin_nominal', 'tampilkan_kode',
                  'salin_kode', 'salin_rujukan', 'salin_referensi', 'qris_tampil', 'buka_aplikasi', 'klik_bukti_wa', 'klik_bukti_email',
                  'klaim_sudah_bayar', 'cardcheck_kunjungan', 'cardcheck_klik_cta', 'survei_kunjungan', 'survei_jawab', 'artikel_pageview',
                  'batch2_kunjungan', 'batch2_cek_ok',
                  // Simulasi Tryout (t_ec85dbfb): beacon halaman /simulasi-tryout/ — kunjungan
                  // (dengan utm kampanye upsell) dan klik CTA ke /beli/. Rujukan bebas
                  // [A-Za-z0-9_-] (mis. sidik sesi demo), tanpa data pribadi.
                  'tryout_kunjungan', 'tryout_klik_beli'];
              const jenis = String(b.jenis || '');
              if (JENIS_PANTAU.indexOf(jenis) === -1) return jawab({ pesan: 'jenis tidak dikenal' }, 400, asal);
              const tryout = jenis.indexOf('tryout_') === 0;
              const kartu = jenis.indexOf('cardcheck_') === 0 || tryout;
              const rincian = String(b.rujukan || '').slice(0, 20);
              if (rincian && !(kartu ? /^[A-Za-z0-9_-]{1,20}$/.test(rincian) : /^SP-[0-9]{3}$/.test(rincian)))
                return jawab({ pesan: 'rincian tidak sah' }, 400, asal);
              const awalan = tryout ? 'tryout:' : kartu ? 'cardcheck:' : 'beli:';
                            // Varian A/B /beli/ (direct traffic: beacon kirim cookie sp_beli_var).
                            // Tag di rincian 'SP-123|var:a' — tanpa kolom baru / migrasi D1.
                            // Nilai di luar ^(a|b)$ dibuang.
                            const varianAb = ['a', 'b'].indexOf(String(b.variant || '').toLowerCase()) !== -1
                              ? String(b.variant).toLowerCase() : '';
                            // Latensi QRIS tampil (detik sejak navigasi, dari beli/script.js):
                            // metrik real "QRIS tampil <2 detik di mobile" tanpa kolom baru.
                            const dtkQris = (jenis === 'qris_tampil' && /^\d{1,4}(\.\d{1,10})?$/.test(String(b.dtk_qris || '')))
                              ? '|d:' + String(b.dtk_qris).slice(0, 10) : '';
                            const rincianTag = rincian + (varianAb ? '|var:' + varianAb : '')
                              + (/^[0-9a-f]{4,32}$/.test(String(b.lacak || '')) ? '|id:' + String(b.lacak).toLowerCase() : '')
                              + dtkQris;
                            const utmSource = String(b.utm_source || '').slice(0, 50);
                            const utmMedium = String(b.utm_medium || '').slice(0, 50);
                            const utmCampaign = String(b.utm_campaign || '').slice(0, 100);
                            const isTest = deteksiUji(utmSource, b.is_test);
                            await env.DB.prepare('INSERT INTO peristiwa (pengguna, jenis, rincian, waktu, utm_source, utm_medium, utm_campaign, is_test) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
                              .bind(null, awalan + jenis, rincianTag, new Date().toISOString(), utmSource, utmMedium, utmCampaign, isTest).run();
                            return jawab({ ok: true }, 200, asal);
                          }

                    // ---- webhook pembayaran QRIS (tanpa login) ----
                    // Terima notifikasi pembayaran dari klien/QRIS manual, catat ke tabel payments
                    if (jalan === '/api/payment-webhook' && request.method === 'POST') {
                      const ip = request.headers.get('CF-Connecting-IP') || 'tanpa-ip';
                      const laju = await batasiLaju(env, ip, 'payment_webhook', 30, 60);
                      if (!laju.boleh) return jawab({ pesan: 'terlalu sering' }, 429, asal);
                      // ===== GERBANG KEAMANAN (23 Okt 2026) =====
                      // Sebelum ini endpoint menerima POST tanpa autentikasi apa pun, lalu:
                      // (a) menulis baris payments is_test=0 yang menaikkan revenue, dan
                      // (b) memanggil aktifkanDariMuatanWebhook() yang MENERBITKAN kode akses.
                      // Artinya siapa pun yang tahu URL-nya bisa mencetak uang dan kode gratis.
                      // Dibuktikan: POST {"amount":39000,"status":"success","txid":"PALSU-OP-1"}
                      // menaikkan revenue 39.000 -> 78.000 tanpa kredensial.
                      //
                      // Sekarang WAJIB membawa header X-Webhook-Secret yang cocok dengan
                      // env.PAYMENT_WEBHOOK_SECRET. Fail closed: kalau secret belum diset,
                      // endpoint mati (503) — bukan terbuka. Tidak ada pemanggil sah lain:
                      // frontend, tools/, dan cron tidak memanggil endpoint ini.
                      const secretEnv = env.PAYMENT_WEBHOOK_SECRET;
                      if (!secretEnv) return jawab({ pesan: 'webhook belum dikonfigurasi' }, 503, asal);
                      const secretDikirim = request.headers.get('X-Webhook-Secret') || '';
                      // Perbandingan waktu-tetap: panjang disamakan dulu supaya tidak bocor.
                      if (secretDikirim.length !== secretEnv.length) {
                        return jawab({ pesan: 'tidak berwenang' }, 401, asal);
                      }
                      let beda = 0;
                      for (let i = 0; i < secretEnv.length; i++) {
                        beda |= secretDikirim.charCodeAt(i) ^ secretEnv.charCodeAt(i);
                      }
                      if (beda !== 0) return jawab({ pesan: 'tidak berwenang' }, 401, asal);
                      const b = await request.json().catch(() => ({}));
                      const timestamp = new Date().toISOString();
                      const utmSource = String(b.utm_source || '').slice(0, 50);
                      const utmMedium = String(b.utm_medium || '').slice(0, 50);
                      const product = String(b.product || 'siappsikotes').slice(0, 50);
                      const amount = Math.round(Number(b.amount)) || 39000;
                      const status = String(b.status || 'success').slice(0, 20);
                      const txid = String(b.txid || '').slice(0, 100);
                      const rawPayload = JSON.stringify(b).slice(0, 5000);
                      // Data hygiene (t_cd642aa0): webhook test/audit/probe ditandai is_test=1 dan
                      // dikeluarkan dari semua metrik revenue. Payload aslinya tetap tersimpan.
                      // Penanda WAJIB sama dengan jalur beacon /api/pantau (baris ~751): kalau
                      // daftar ini lebih sempit, transaksi uji ber-utm 'uji-*'/'probe'/'verify-task'
                      // lolos sebagai is_test=0 dan menggelembungkan revenue (terjadi 2026-10-22:
                      // UJI-E2E-143 masuk sebagai paid Rp 39.143).
                      const penandaUji = ['uji-', 'uji_', 'probe', 'audit', 'verify-task', 'test', 'smoke', 'dummy'];
                      const isTest = (() => {
                        const src = utmSource.toLowerCase();
                        if (penandaUji.some(m => src.startsWith(m))) return 1;
                        if (penandaUji.some(m => src.indexOf(m) !== -1)) return 1;
                        if (b.is_test === 1 || b.is_test === '1' || b.is_test === true) return 1;
                        if (b.probe === 1 || b.probe === '1') return 1;
                        const tx = String(b.txid || '').toUpperCase();
                        if (/^(UJI|PROBE|TEST|SMOKE|DUMMY)[-_]/.test(tx)) return 1;
                        return 0;
                      })();
                      const rujukan = String(b.rujukan || '').toUpperCase().trim().slice(0, 12);
                      const ins = await env.DB.prepare(
                        'INSERT INTO payments (timestamp, utm_source, utm_medium, product, amount, status, txid, raw_payload, is_test, rujukan) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
                      ).bind(timestamp, utmSource, utmMedium, product, amount, status, txid, rawPayload, isTest, rujukan || null).run();
                      // Pencocokan arah masuk (fallback tanpa Tripay, t_3a03d4b4): muatan yang
                      // barusan tercatat mencari pesanannya sendiri — klaim "sudah bayar" yang
                      // masih menunggu_verifikasi naik ke lunas, dan pesanan yang lupa diklaim
                      // pun terbit kode pembayaran-nya (webhook-auto). Data uji tetap ikut
                      // matching (guard TG/metrik tetap hormat is_test); jejaknya dicatat
                      // peristiwa beli:match_webhook dengan is_test sama muatannya.
                      try { await aktifkanDariMuatanWebhook(env, { id: ins && ins.meta && ins.meta.last_row_id, amount, timestamp, txid, rujukan: rujukan || null, is_test: isTest }); } catch (e) {}
                      // Kirim notifikasi Telegram hanya untuk pembayaran yang bukan data test
                      if ((status === 'success' || status === 'paid') && !isTest) {
                        const alertMsg = `✅ <b>Pembayaran Baru</b>\nProduk: ${product}\nJumlah: Rp ${amount.toLocaleString()}\nUTM: ${utmSource} / ${utmMedium}\nTXID: ${txid || '-'}\nWaktu: ${timestamp}`;
                        await kirimTelegramAlert(env, alertMsg);
                        // Push instan sudah terkirim: majukan guard sweep alert revenue supaya
                        // baris ini tidak di-push ulang oleh cron */10 (sweepBayarBaru).
                        try {
                          const idBaru = ins && ins.meta && ins.meta.last_row_id;
                          if (idBaru) {
                            const lama = parseInt(await env.FUNNEL_KV.get('alert:pay:last_rowid'), 10) || 0;
                            if (idBaru > lama) await env.FUNNEL_KV.put('alert:pay:last_rowid', String(idBaru));
                          }
                        } catch (e) {}
                        // payments.status success -> kode referensi pembeli terbit + reward referrer
                        // bila pesanan itu memakai kode (mekanisme FINAL, anti-abuse di beriRewardRef).
                        if (/^SP-\d{3}$/.test(rujukan)) {
                          const harapan = await nominalDiharapkan(env, rujukan);
                          await terbitkanKodeRef(env, rujukan);
                          if (harapan.ref_kode) await beriRewardRef(env, harapan.ref_kode, rujukan, amount);
                        }
                      }
                      return jawab({ ok: true }, 200, asal);
                    }

                    // ---- pemesanan: pembeli menekan "Tampilkan kode" -> catat pesanan menunggu_bayar ----
                    // Tanpa login. Rujukan SP-xxx yang pembeli buat sendiri di perangkatnya jadi kunci
                    // pesanan; nominal unik dihitung SERVER dari rumus 39000+3digit, tidak dipercaya dari klien.
                    if (jalan === '/api/beli/kode' && request.method === 'POST') {
                      const ip = request.headers.get('CF-Connecting-IP') || 'tanpa-ip';
                      const laju = await batasiLaju(env, ip, 'beli_kode', 20, 60);
                      if (!laju.boleh) return jawab({ pesan: 'terlalu sering' }, 429, asal);
                      const b = await request.json().catch(() => ({}));
                      const rujukan = String(b.rujukan || '').toUpperCase().trim().slice(0, 12);
                      if (!/^SP-\d{3}$/.test(rujukan)) return jawab({ pesan: 'rujukan tidak sah (harus SP-3digit)' }, 400, asal);
                      const kini = new Date().toISOString();
                      const kode = kodeDariRujukan(rujukan);
                      const hash = await hashKodeTerbit(kode);
                      // Kode referensi (opsional): sah -> harga dasar jadi Rp 34.000 (diskon Rp 5.000).
                      // Sesi pembeli ≠ referrer: kode yang lahir dari rujukan yang sama ditolak.
                      const refMasuk = String(b.ref || '').toUpperCase().trim().slice(0, 12);
                      const refBaris = (await kodeRefValid(env, refMasuk))
                        ? await env.DB.prepare('SELECT payment_id FROM referral_kode WHERE kode = ?').bind(refMasuk).first()
                        : null;
                      const refPakai = (refBaris && refBaris.payment_id !== rujukan) ? refMasuk : null;
                      // Set Soal Batch 2 (skus=batch2): agar pemasarannya jujur, pemesanan hanya
                      // bisa lewat kode akses penuh yang SUDAH lunas — token HMAC 15 menit dari
                      // POST /api/batch2/cek. Harga dasar 29.000 tetap dihitung SERVER.
                      const skus = String(b.skus || '').trim();
                      const pesanBatch2 = skus === 'batch2';
                      let dasarNominal = nominalDasar(refPakai);
                      if (pesanBatch2) {
                        if (!env.KLAIM_HMAC_SECRET) return jawab({ pesan: 'verifikasi kode belum aktif' }, 503, asal);
                        const isi = await periksaTokenKlaim(env, b.batch2_token);
                        if (!isi || isi.tujuan !== 'batch2') return jawab({ pesan: 'periksa kode aksesmu dulu di atas — kode ini belum terverifikasi' }, 403, asal);
                        if (Date.now() - (isi.waktu || 0) > 15 * 60e3) return jawab({ pesan: 'verifikasi kode kedaluwarsa — tempel ulang kode aksesnya' }, 403, asal);
                        const cek = await env.DB.prepare('SELECT dibayar, asal FROM kode_terbit WHERE kode_hash = ?').bind(isi.kode_hash).first();
                        if (!kodeBatch2Sah(cek)) return jawab({ pesan: 'kode aksesnya belum sah untuk harga khusus ini' }, 403, asal);
                        // Rujukan SP-xxx menghasilkan kode akses dari rumus yang memang satu-satunya
                        // per rujukan: kalau rujukan itu sudah jadi pesanan lain (lunas), nominal
                        // JANGAN medsapingin — minta angka lain supaya catatan setoran tetap polos.
                        const sudah = await env.DB.prepare('SELECT dibayar, nominal FROM kode_terbit WHERE kode_hash = ?').bind(hash).first();
                        if (sudah) return jawab({ pesan: 'rujukan ' + rujukan + ' sudah pernah dipakai pesanan lain — pilih 3 angka lain di kolom rujukan' }, 400, asal);
                        dasarNominal = 29000;
                      }
                      const nominalBaru = dasarNominal + parseInt(rujukan.slice(3), 10);
                      // Idempoten: klik "Tampilkan kode" berkali kali -> satu baris yang sama (dibayar tetap apa adanya).
                      const baru = await env.DB.prepare(
                        'INSERT INTO kode_terbit (kode_hash, kode_akhir, terbit, dibayar, rujukan, nominal, asal, ref_kode) VALUES (?, ?, ?, NULL, ?, ?, ?, ?) ON CONFLICT(kode_hash) DO NOTHING'
                      ).bind(hash, kode.slice(-6), kini, rujukan, nominalBaru, 'menunggu-bayar', refPakai).run();
                      let refTerpasang = null;
                      let nominalTercatat = nominalDariRujukan(rujukan);
                      if (baru.meta.changes > 0) {
                        refTerpasang = refPakai;
                        nominalTercatat = nominalBaru;
                      } else if (refPakai) {
                        // Ref bisa datang belakangan (pembeli membuka /beli/?ref= dengan rujukan lama):
                        // dipasang hanya pada pesanan yang belum dibayar dan belum memakai ref.
                        const pasang = await env.DB.prepare(
                          'UPDATE kode_terbit SET ref_kode = ?, nominal = ? WHERE kode_hash = ? AND dibayar IS NULL AND ref_kode IS NULL'
                        ).bind(refPakai, nominalBaru, hash).run();
                        if (pasang.meta.changes > 0) {
                          refTerpasang = refPakai;
                          nominalTercatat = nominalBaru;
                        }
                      }
                      if (refTerpasang) {
                        await env.DB.prepare("INSERT INTO referral_konversi (kode, pembayaran_baru, waktu, status, nominal, utm_source, utm_medium, utm_campaign) VALUES (?, ?, ?, 'checkout', ?, ?, ?, ?)")
                          .bind(refTerpasang, rujukan, kini, nominalTercatat,
                                String(b.utm_source || '').slice(0, 50), String(b.utm_medium || '').slice(0, 50), String(b.utm_campaign || '').slice(0, 100)).run();
                      }
                      const baris = await env.DB.prepare('SELECT dibayar, asal, nominal, ref_kode FROM kode_terbit WHERE kode_hash = ?').bind(hash).first();
                      if (baris) { nominalTercatat = Number(baris.nominal) || nominalTercatat; refTerpasang = baris.ref_kode || null; }
                      await env.DB.prepare('INSERT INTO peristiwa (pengguna, jenis, rincian, waktu, utm_source, utm_medium, utm_campaign) VALUES (?, ?, ?, ?, ?, ?, ?)')
                        .bind(null, pesanBatch2 ? 'beli:order-batch2' : 'beli:order', rujukan + '|' + nominalTercatat + (refTerpasang ? '|ref:' + refTerpasang : ''), kini, String(b.utm_source || '').slice(0, 50), String(b.utm_medium || '').slice(0, 50), String(b.utm_campaign || '').slice(0, 100)).run();
                      // Token klaim diterbitkan bila rahasia jalur B sudah dipasang; tanpa itu pesanan
                      // tetap tercatat dan kode tetap tampil (jalur manual pemilik tetap bekerja).
                      const klaim_token = env.KLAIM_HMAC_SECRET ? await buatTokenKlaim(env, { rujukan, nominal: nominalTercatat }) : null;
                      return jawab({ ok: true, rujukan, nominal: nominalTercatat, diskon: refTerpasang ? HARGA_DASAR - HARGA_REF : 0,
                                     kode, status: statusPesanan(baris), klaim_token,
                                     tripay_aktif: !!(env.TRIPAY_API_KEY && env.TRIPAY_PRIVATE_KEY && env.TRIPAY_KODE_MERCHANT) }, 200, asal);
                    }

                    // ---- klaim "Saya sudah bayar" (jalur interim B, tanpa akun baru) ----
                    // Tombol halaman beli mengirim token HMAC yang diterbitkan server saat pesanan
                    // dibuat. Hasilnya MENUNGGU_VERIFIKASI (bukan success): kode langsung aktif, dan
                    // laporan harian 23:55 WIB mencocokkan klaim ini dengan pembayaran yang benar-benar masuk.
                    if (jalan === '/api/beli/klaim' && request.method === 'POST') {
                      const ip = request.headers.get('CF-Connecting-IP') || 'tanpa-ip';
                      const laju = await batasiLaju(env, ip, 'beli_klaim', 10, 60);
                      if (!laju.boleh) return jawab({ pesan: 'terlalu sering' }, 429, asal);
                      if (!env.KLAIM_HMAC_SECRET) return jawab({ pesan: 'verifikasi klaim belum aktif' }, 503, asal);
                      const b = await request.json().catch(() => ({}));
                      const rujukan = String(b.rujukan || '').toUpperCase().trim().slice(0, 12);
                      if (!/^SP-\d{3}$/.test(rujukan)) return jawab({ pesan: 'rujukan tidak sah' }, 400, asal);
                      const isi = await periksaTokenKlaim(env, b.klaim_token);
                      if (!isi || isi.rujukan !== rujukan) return jawab({ pesan: 'token klaim tidak sah — tekan dulu Tampilkan kode' }, 400, asal);
                      if (Date.now() - (isi.waktu || 0) > 48 * 3600e3) return jawab({ pesan: 'token klaim kedaluwarsa — muat ulang halaman' }, 400, asal);
                      const hash = await hashKodeTerbit(kodeDariRujukan(rujukan));
                      const kini = new Date().toISOString();
                      // Klaim pertama yang menang; klaim ulang tidak menggeser waktu/rujukan apa pun.
                      const hasil = await env.DB.prepare("UPDATE kode_terbit SET dibayar = ?, asal = 'klaim' WHERE kode_hash = ? AND dibayar IS NULL").bind(kini, hash).run();
                      const baris = await env.DB.prepare('SELECT kode_hash, dibayar, asal, nominal, terbit FROM kode_terbit WHERE kode_hash = ?').bind(hash).first();
                      if (!baris) return jawab({ pesan: 'pesanan tidak ditemukan — tekan dulu Tampilkan kode' }, 404, asal);
                      // Klaim uji (is_test/manual) tetap ditandai is_test: tidak memekikkan
                      // Telegram & tidak mencemari metrik (sama-dengan jalur lain).
                      const ujiKlaim = b.is_test === true || b.is_test === 1 || b.is_test === '1' || b.probe === 1;
                      // Pencocokan instan (t_3a03d4b4): muatan webhook yang SUDAH masuk (CSV/JSON
                      // nominal+jam) langsung dites — kalau cocok, klaim ini naik ke lunas saat
                      // itu juga tanpa menunggu cron/laporan harian.
                      if (baris.asal === 'klaim') {
                        const cocokInstan = await cariBayarCocok(env, baris.nominal, baris.terbit);
                        if (cocokInstan) await tandaKlaimCocok(env, baris, cocokInstan, kini);
                      }
                      const barisBaru = await env.DB.prepare('SELECT dibayar, asal, nominal FROM kode_terbit WHERE kode_hash = ?').bind(hash).first();
                      const cocokWebhook = ['klaim-webhook', 'webhook-auto', 'tripay'].indexOf(barisBaru.asal) !== -1;
                      if (hasil.meta.changes > 0) {
                        // Kontak opsional klaimer (WA/email) untuk tindak lanjut rekonsiliasi
                        // oleh tim marketing. Disanitasi ketat; ditulis hanya pada klaim pertama.
                        const kontakMasuk = String(b.kontak || '').trim();
                        const kontak = /^[\w@+.\-\s]{1,64}$/.test(kontakMasuk) ? kontakMasuk.slice(0, 64) : null;
                        if (kontak) await env.DB.prepare("UPDATE kode_terbit SET kontak = ? WHERE kode_hash = ? AND asal = 'klaim'").bind(kontak, hash).run();
                        await env.DB.prepare('INSERT INTO peristiwa (pengguna, jenis, rincian, waktu, is_test) VALUES (?, ?, ?, ?, ?)')
                          .bind(null, 'beli:klaim_bayar', rujukan + '|' + baris.nominal, kini, ujiKlaim ? 1 : 0).run();
                        // Pembayaran aktif -> kode referensi pembeli terbit (idempoten per rujukan).
                        // CATATAN (23 Okt 2026): jalur ini memang terbit untuk klaim "sudah bayar"
                        // karena tombol klaim MENULIS dibayar sendiri (UPDATE ... SET dibayar).
                        // Risiko: orang bisa menekan klaim lalu memakai REF-XXXX untuk diskon
                        // Rp 5.000 tanpa mentransfer. Mitigasi ada di rekonsiliasi harian 23:55
                        // yang mencocokkan klaim vs pembayaran NYATA; klaim tanpa bayar tetap
                        // tercatat menunggu_verifikasi dan tagihannya muncul di laporan.
                        await terbitkanKodeRef(env, rujukan);
                        if (!ujiKlaim) await kirimTelegramAlert(env, '🧾 <b>Klaim "sudah bayar" diterima</b>\nRujukan: ' + rujukan +
                          '\nNominal: Rp ' + Number(baris.nominal).toLocaleString('id-ID') +
                          (cocokWebhook ? '\n✅ Tercocok otomatis dengan muatan webhook — lunas'
                                        : '\n⏳ Belum ketemu muatan webhook — dicek otomatis maksimal 15 menit (manual bila lewat)') +
                          (kontak ? '\nKontak: ' + kontak : '\nKontak: (tidak diisi)') +
                          '\nKode akses: AKTIF');
                      }
                      const referensi = barisBaru.dibayar ? await terbitkanKodeRef(env, rujukan) : null;
                      return jawab({ ok: true, status: statusPesanan(barisBaru), referensi,
                                     pesan: cocokWebhook ? '✅ Pembayaran tercocok otomatis dengan catatan QRIS — lunas.'
                                       : 'Kode aktif — pembayaran dicek otomatis, lunas maksimal 15 menit.' }, 200, asal);
                    }

                    // ---- status pesanan (dipakai polling halaman beli) ----
                    if (jalan === '/api/beli/status' && request.method === 'GET') {
                      const rujukan = (url.searchParams.get('rujukan') || '').toUpperCase().trim().slice(0, 12);
                      if (!/^SP-\d{3}$/.test(rujukan)) return jawab({ pesan: 'rujukan tidak sah' }, 400, asal);
                      const baris = await env.DB.prepare('SELECT dibayar, asal, nominal FROM kode_terbit WHERE kode_hash = ?')
                        .bind(await hashKodeTerbit(kodeDariRujukan(rujukan))).first();
                      // Pesanan lunas -> kode referensi pembeli siap tampil di halaman sukses (idempoten).
                      const referensi = (baris && baris.dibayar) ? await terbitkanKodeRef(env, rujukan) : null;
                      return jawab({ ok: true, rujukan, status: statusPesanan(baris),
                                     nominal: baris ? baris.nominal : (await nominalDiharapkan(env, rujukan)).nominal,
                                     referensi }, 200, asal);
                    }

                    // ---- retensi & Batch 2 (spesifikasi retensi 30 hari, t_5d6bf642) ----
                    // Pembacaan saja: webhook Tripay, skema payments, dan alur klaim kode_terbit
                    // TIDAK diubah. Segmen menurut umur pembayaran (kolom dibayar): H0-H2, H3-H13,
                    // H14-H27, H28+ — dipakai skrip harian scripts/retensi-harian.sh.
                    function segmenRetensi(hari) {
                      if (hari <= 2) return 'SEG-1';
                      if (hari <= 13) return 'SEG-2';
                      if (hari <= 27) return 'SEG-3';
                      return 'SEG-4';
                    }

                    // CSV daftar follow-up pembeli lunas. Token pola /api/laporan/funnel
                    // (LAPORAN_TOKEN — lihat scripts/ekspor-funnel.sh). Kosong tetap 200 + header.
                    if (jalan === '/api/laporan/retensi' && request.method === 'GET') {
                      const u = new URL(request.url);
                      const token = u.searchParams.get('token') || (request.headers.get('X-Token') || '');
                      if (!env.LAPORAN_TOKEN || token !== env.LAPORAN_TOKEN) return jawab({ pesan: 'token tidak sah' }, 403, asal);
                      // Hanya rujukan sah SP-3digit (pola pesanan nyata /api/beli/kode) — membuang
                      // baris uji/audit (SP-Munger-Test dan sejenisnya) agar tidak dikirimi pesan.
                      const daftar = await env.DB.prepare("SELECT rujukan, kode_akhir, kontak, dibayar FROM kode_terbit WHERE dibayar IS NOT NULL AND rujukan GLOB 'SP-[0-9][0-9][0-9]' ORDER BY dibayar ASC LIMIT 5000").all();
                      const kini = Date.now();
                      const kutip = t => '"' + String(t || '').replace(/"/g, '""') + '"';
                      const csv = ['rujukan,kode_akhir,kontak,segmen,hari_sejak_bayar'].concat((daftar.results || []).map(r => {
                        const hari = Math.max(0, Math.floor((kini - new Date(r.dibayar).getTime()) / 864e5));
                        return [kutip(r.rujukan), kutip(r.kode_akhir), kutip(r.kontak), segmenRetensi(hari), hari].join(',');
                      })).join('\n') + '\n';
                      return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="retensi.csv"' } });
                    }

                    // ---- CSV funnel 1-baris per pembayaran (t_eece4f7e) ----
                    // Satu baris per pembayaran QRIS lunas: rujukan -> kunjungan (client beacon +
                    // server-side), utm, varian A/B, harga, ts bayar, txid. Sumber 100% tabel D1,
                    // jadi apapun jalurnya (webhook Tripay, payment-webhook, klaim) barisnya muncul
                    // dan funnel bisa direkonstruksi dari CSV ini saja. Is_test diambil dari
                    // kunjungan/pembayaran supaya baris uji tidak mencemari keputusan harga.
                    if (jalan === '/api/funnel/beli.csv' && request.method === 'GET') {
                      const u = new URL(request.url);
                      const token = u.searchParams.get('token') || (request.headers.get('X-Token') || '');
                      if (!env.LAPORAN_TOKEN || token !== env.LAPORAN_TOKEN) return jawab({ pesan: 'token tidak sah' }, 403, asal);
                      const kutip = t => '"' + String(t == null ? '' : t).replace(/"/g, '""') + '"';
                      const [lunas, kunjungan, kunjunganSrv, bayarWeb] = await Promise.all([
                        env.DB.prepare("SELECT rujukan, kode_akhir, terbit, dibayar, nominal, asal FROM kode_terbit WHERE dibayar IS NOT NULL AND rujukan GLOB 'SP-[0-9][0-9][0-9]' ORDER BY dibayar DESC LIMIT 5000").all(),
                        env.DB.prepare("SELECT rincian, waktu, utm_source, utm_medium, utm_campaign, is_test FROM peristiwa WHERE jenis = 'beli:kunjungan_beli' AND rincian GLOB 'SP-[0-9][0-9][0-9]*' ORDER BY waktu ASC LIMIT 20000").all(),
                        env.DB.prepare("SELECT rincian, waktu FROM peristiwa WHERE jenis = 'beli:kunjungan_server' ORDER BY waktu ASC LIMIT 20000").all(),
                        env.DB.prepare("SELECT rujukan, txid, timestamp, amount, is_test FROM payments WHERE status IN ('success','paid') AND rujukan GLOB 'SP-[0-9][0-9][0-9]' ORDER BY timestamp DESC LIMIT 5000").all()
                      ]);
                      // Kunjungan client rujukan: ambil yang TERAWAL (touch pertama + utm & varian saat itu).
                      const visit = {};
                      for (const p of (kunjungan.results || [])) {
                        const rjk = String(p.rincian || '').split('|')[0];
                        if (!/^SP-[0-9]{3}$/.test(rjk) || visit[rjk]) continue;
                        const im = /(?:^|\|)var:([ab])/.exec(p.rincian), ii = /(?:^|\|)id:([0-9a-f]+)/.exec(p.rincian);
                        visit[rjk] = { waktu: p.waktu, utm_source: p.utm_source, utm_medium: p.utm_medium,
                                       utm_campaign: p.utm_campaign, varian: im ? im[1] : '',
                                       id: ii ? ii[1] : '', is_test: p.is_test || 0 };
                      }
                      // Kunjungan server-side menurut id lacak (pageview matematis selalu tercatat).
                      const visitSrv = {};
                      for (const p of (kunjunganSrv.results || [])) {
                        const ii = /(?:^|\|)id:([0-9a-f]+)/.exec(String(p.rincian || ''));
                        if (!ii || visitSrv[ii[1]]) continue;
                        visitSrv[ii[1]] = p.waktu;
                      }
                      // Pembayaran sukses via /api/payment-webhook yang tidak mempunyai baris kode_terbit lunas.
                      const viaWeb = {};
                      for (const p of (bayarWeb.results || [])) {
                        if (!viaWeb[p.rujukan]) viaWeb[p.rujukan] = p;
                      }
                      const barisKunci = {};
                      for (const k of (lunas.results || [])) barisKunci[k.rujukan] = { ...k, kodeBenar: true };
                      for (const rjk of Object.keys(viaWeb)) {
                        if (!barisKunci[rjk]) barisKunci[rjk] = { rujukan: rjk, kode_akhir: '', terbit: null,
                          dibayar: viaWeb[rjk].timestamp, nominal: Math.round(Number(viaWeb[rjk].amount)) || null, asal: 'webhook' };
                      }
                      const barisCsv = Object.values(barisKunci).map(k => {
                        const v = visit[k.rujukan] || {};
                        const isTest = (v.is_test || 0) || (viaWeb[k.rujukan] && viaWeb[k.rujukan].is_test) || 0;
                        return [k.rujukan, k.kode_akhir, v.utm_source || '', v.utm_medium || '', v.utm_campaign || '',
                                v.varian || '', v.waktu || '', v.id ? (visitSrv[v.id] || '') : '',
                                k.nominal, k.dibayar, k.asal, (viaWeb[k.rujukan] && viaWeb[k.rujukan].txid) || '', isTest];
                      }).sort((a, b) => String(b[9]).localeCompare(String(a[9])));
                      const csv = ['rujukan,kode_akhir,utm_source,utm_medium,utm_campaign,varian,ts_visit,ts_visit_server,harga,ts_bayar,asal,txid,is_test']
                        .concat(barisCsv.map(r => r.map(kutip).join(','))).join('\n') + '\n';
                      return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="funnel-beli.csv"' } });
                    }

                    // DAFTAR asal yang membuat baris kode_terbit dianggap SAH & lunas.
                    // Pakai di semua keputusan Batch 2 agar standarnya satu.
                    function kodeBatch2Sah(baris) {
                      return !!(baris && baris.dibayar && baris.asal && ['tripay', 'klaim', 'klaim-webhook', 'webhook-auto', 'klaim-cron', 'alat-pemilik'].indexOf(baris.asal) !== -1);
                    }

                    // POST /api/batch2/cek — khusus pemilik kode akses penuh yang SUDAH lunas.
                    // body { kode: "SP..." } → 200 + token HMAC 15 menit; 404 tidak dikenal; 403 belum lunas.
                    if (jalan === '/api/batch2/cek' && request.method === 'POST') {
                      const ip = request.headers.get('CF-Connecting-IP') || 'tanpa-ip';
                      const laju = await batasiLaju(env, ip, 'batch2_cek', 10, 60);
                      if (!laju.boleh) return jawab({ pesan: 'terlalu sering' }, 429, asal);
                      if (!env.KLAIM_HMAC_SECRET) return jawab({ pesan: 'verifikasi kode belum aktif' }, 503, asal);
                      const b = await request.json().catch(() => ({}));
                      const kode = String(b.kode || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
                      if (kode.length < 8 || kode.slice(0, 2) !== 'SP') return jawab({ pesan: 'kode tidak sah (contoh: SPXXXXXXXXXXXX)' }, 400, asal);
                      const hash = await hashKodeTerbit(kode);
                      const baris = await env.DB.prepare('SELECT kode_akhir, asal, dibayar, nominal FROM kode_terbit WHERE kode_hash = ?').bind(hash).first();
                      if (!baris) return jawab({ pesan: 'kode tidak dikenal — periksa tulisan kodenya' }, 404, asal);
                      if (!kodeBatch2Sah(baris)) return jawab({ pesan: 'kode ini belum lunas — selesaikan pembayaran akses penuh dulu' }, 403, asal);
                      const token = await buatTokenKlaim(env, { tujuan: 'batch2', kode_hash: hash });
                      const batas = /^SP-(\d{3})$/.exec(String(baris.rujukan || ''));
                      const dasar = 29000;
                      return jawab({ ok: true, token, kode_akhir: baris.kode_akhir,
                                     nominal_dasar: dasar, teks_harga: 'Rp 29.000 sekali bayar, bukan langganan',
                                     rujukan: batas ? batas[0] : null }, 200, asal);
                    }

                    // GET /api/batch2/status?kode=... — izin konten Batch 2 di aplikasi.
                    // Kuncinya BARIS di kode_terbit dengan nominal 29.xxx (not angka halaman):
                    // kode akses penuh biasa (39.xxx) tidak membuka Batch 2.
                    if (jalan === '/api/batch2/status' && request.method === 'GET') {
                      const kode = (url.searchParams.get('kode') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
                      if (kode.length < 8 || kode.slice(0, 2) !== 'SP') return jawab({ pesan: 'kode tidak sah' }, 400, asal);
                      const hash = await hashKodeTerbit(kode);
                      const baris = await env.DB.prepare('SELECT kode_akhir, asal, dibayar, nominal FROM kode_terbit WHERE kode_hash = ?').bind(hash).first();
                      const buka = kodeBatch2Sah(baris)
                        && Number(baris.nominal) >= 29000 && Number(baris.nominal) < 30000
                        && baris.asal !== 'menunggu-bayar';
                      return jawab({ ok: true, kode_akhir: baris ? baris.kode_akhir : null, batch2: !!buka, nominal: baris ? baris.nominal : null }, 200, asal);
                    }

                    // ---- webhook Tripay (jalur A utama: QRIS dinamis, pembayaran terverifikasi) ----
                    // Tripay mengirim POST dengan header X-Callback-Signature = HMAC-SHA256(raw body,
                    // private key). Kunci dipasang pemilik lewat `wrangler secret put TRIPAY_PRIVATE_KEY`
                    // (+ TRIPAY_API_KEY & TRIPAY_KODE_MERCHANT untuk membuat transaksi) — tidak pernah
                    // ditulis di kode atau repo. status=PAID + rujukan/nominal cocok -> dibayar otomatis.
                    if (jalan === '/api/tripay/webhook' && request.method === 'POST') {
                      const ip = request.headers.get('CF-Connecting-IP') || 'tanpa-ip';
                      const laju = await batasiLaju(env, ip, 'tripay_webhook', 120, 60);
                      if (!laju.boleh) return jawab({ pesan: 'terlalu sering' }, 429, asal);
                      if (!env.TRIPAY_PRIVATE_KEY) return jawab({ pesan: 'Tripay belum dikonfigurasi' }, 503, asal);
                      const raw = await request.text();
                      const tanda = request.headers.get('X-Callback-Signature') || '';
                      let sah = false;
                      try {
                        const kunci = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.TRIPAY_PRIVATE_KEY), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
                        sah = await crypto.subtle.verify('HMAC', kunci, hexKeBytes(tanda), new TextEncoder().encode(raw));
                      } catch (e) { sah = false; }
                      if (!sah) return jawab({ pesan: 'signature tidak sah' }, 401, asal);
                      const b = JSON.parse(raw);
                      const kini = new Date().toISOString();
                      const rujukan = String(b.merchant_ref || '').toUpperCase().trim().slice(0, 12);
                      const nominal = Math.round(Number(b.payment_amount || b.amount || 0)) || 0;
                      const status = String(b.status || '').toUpperCase();
                      // Uang yang benar-benar masuk tidak pernah dibuang: SEMUA notifikasi PAID dicatat.
                      await env.DB.prepare(
                        'INSERT INTO payments (timestamp, utm_source, utm_medium, product, amount, status, txid, raw_payload, is_test, rujukan) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)'
                      ).bind(kini, 'tripay', String(b.payment_method || '').slice(0, 50), 'siappsikotes', nominal,
                             status === 'PAID' ? 'paid' : status.toLowerCase().slice(0, 20),
                             String(b.reference || '').slice(0, 100), raw.slice(0, 5000), rujukan || null).run();
                      if (status === 'PAID' && /^SP-\d{3}$/.test(rujukan)) {
                        const harapan = await nominalDiharapkan(env, rujukan);
                        if (nominal === harapan.nominal) {
                        const hash = await hashKodeTerbit(kodeDariRujukan(rujukan));
                        const hasil = await env.DB.prepare("UPDATE kode_terbit SET dibayar = ?, asal = 'tripay' WHERE kode_hash = ? AND dibayar IS NULL").bind(kini, hash).run();
                        // Pembayaran sukses terverifikasi: kode referensi pembeli terbit + reward
                        // referrer (bila pesanan memakai kode) sesuai mekanisme FINAL.
                        await terbitkanKodeRef(env, rujukan);
                        if (harapan.ref_kode) await beriRewardRef(env, harapan.ref_kode, rujukan, nominal);
                        await env.DB.prepare('INSERT INTO peristiwa (pengguna, jenis, rincian, waktu) VALUES (?, ?, ?, ?)')
                          .bind(null, 'beli:bayar_terkonfirmasi', rujukan + '|' + nominal, kini).run();
                        await kirimTelegramAlert(env, '💰 <b>Pembayaran QRIS terkonfirmasi otomatis</b>\nRujukan: ' + rujukan +
                          '\nNominal: Rp ' + nominal.toLocaleString('id-ID') + '\nTripay ref: ' + (b.reference || '-') +
                          '\nKode akses: AKTIF (terbuka otomatis di halaman beli)');
                        return jawab({ success: true, kode_dibayar: 'dibayar' });
                        }
                      }
                      if (status === 'PAID' && /^SP-\d{3}$/.test(rujukan)) {
                        // Nominal cocok tapi kode sudah dibayar (klaim lebih dulu), ATAU nominal tidak
                        // persis sama — catat dan biarkan laporan harian mencocokkan mutasinya.
                        const sudah = await env.DB.prepare('SELECT dibayar, asal, nominal FROM kode_terbit WHERE kode_hash = ?').bind(await hashKodeTerbit(kodeDariRujukan(rujukan))).first();
                        if (sudah && sudah.dibayar) {
                          return jawab({ success: true, kode_dibayar: 'sudah-dibayar-sebelumnya' });
                        }
                      }
                      // PAID tapi tidak cocok (rujukan/nominal beda) atau status lain: tetap 200 supaya
                      // Tripay tidak mengulang terus; laporan harian pemilik mencocokkan sisanya.
                      await kirimTelegramAlert(env, '⚠️ <b>Webhook Tripay belum cocok dengan pesanan</b>\nRujukan: ' + rujukan +
                        '\nNominal: Rp ' + nominal.toLocaleString('id-ID') + '\nStatus: ' + (status || '-'));
                      return jawab({ success: true, cocok: false });
                    }

                    // ---- buat transaksi QRIS dinamis Tripay (jalur A) ----
                    // Dipanggil halaman beli setelah /api/beli/kode bila tripay_aktif. Tanpa kunci,
                    // 503 — halaman memakai QRIS statis + jalur klaim B sementara itu.
                    if (jalan === '/api/tripay/transaksi' && request.method === 'POST') {
                      const ip = request.headers.get('CF-Connecting-IP') || 'tanpa-ip';
                      const laju = await batasiLaju(env, ip, 'tripay_buat', 20, 60);
                      if (!laju.boleh) return jawab({ pesan: 'terlalu sering' }, 429, asal);
                      if (!env.TRIPAY_API_KEY || !env.TRIPAY_PRIVATE_KEY || !env.TRIPAY_KODE_MERCHANT)
                        return jawab({ pesan: 'Tripay belum dikonfigurasi — pakai QRIS statis dulu' }, 503, asal);
                      const b = await request.json().catch(() => ({}));
                      const rujukan = String(b.rujukan || '').toUpperCase().trim().slice(0, 12);
                      if (!/^SP-\d{3}$/.test(rujukan)) return jawab({ pesan: 'rujukan tidak sah' }, 400, asal);
                      // Nominal pesanan mengikuti catatan server (bisa sudah kena diskon referensi).
                      const nominal = (await nominalDiharapkan(env, rujukan)).nominal;
                      const tanda = await hmacHex(env.TRIPAY_PRIVATE_KEY, env.TRIPAY_KODE_MERCHANT + rujukan + nominal);
                      const dasarApi = String(env.TRIPAY_MODE || '') === 'sandbox' ? 'https://tripay.co.id/api-sandbox' : 'https://tripay.co.id/api';
                      let d = null;
                      try {
                        const r = await fetch(dasarApi + '/transaction/create', {
                          method: 'POST',
                          headers: { 'Authorization': 'Bearer ' + env.TRIPAY_API_KEY, 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            method: 'QRIS', merchant_ref: rujukan, amount: nominal,
                            customer_name: String(b.nama || 'Pembeli SiapPsikotes').slice(0, 60),
                            customer_email: String(b.email || 'pembeli@siappsikotes.my.id').slice(0, 80),
                            signature: tanda, expired_time: Math.floor(Date.now() / 1000) + 86400,
                            order_items: [{ sku: 'SIAAP-PREMIUM', name: 'Akses premium SiapPsikotes', price: nominal, quantity: 1 }]
                          })
                        });
                        d = await r.json().catch(() => null);
                        if (!r.ok || !d || d.success === false) d = null;
                      } catch (e) { d = null; }
                      if (!d) return jawab({ pesan: 'Tripay sedang tidak bisa dihubungi — pakai QRIS statis dulu' }, 502, asal);
                      return jawab({ ok: true, rujukan, nominal, reference: d.data && d.data.reference,
                                     pay_url: d.data && d.data.pay_url, qr_url: d.data && d.data.qr_url,
                                     qr_image: d.data && d.data.qr_image, expired_time: d.data && d.data.expired_time }, 200, asal);
                    }

                    // ---- pemilik: ringkasan funnel pembelian (jumlah per jenis event, kunjukan unik per rujukan) ----
      if (jalan === '/api/pemilik/funnel-beli' && request.method === 'GET') {
        if (!saya) return perluMasuk();
        if (!adalahPemilik(saya)) return jawab({ pesan: 'bukan pemilik' }, 403, asal);
        const perJenis = await env.DB.prepare(
          "SELECT jenis, COUNT(*) AS n, COUNT(DISTINCT rincian) AS rujukan_unik " +
          "FROM peristiwa WHERE jenis LIKE 'beli:%' AND is_test = 0 GROUP BY jenis ORDER BY jenis"
        ).all();
        const perHari = await env.DB.prepare(
          "SELECT substr(waktu,1,10) AS hari, jenis, COUNT(*) AS n FROM peristiwa " +
          "WHERE jenis LIKE 'beli:%' AND is_test = 0 GROUP BY hari, jenis ORDER BY hari DESC, jenis LIMIT 400"
        ).all();
        return jawab({ per_jenis: perJenis.results || [], per_hari: perHari.results || [] }, 200, asal);
      }

      if (jalan === '/api/pemilik/kode-terbit' && request.method === 'GET') {
        if (!saya) return perluMasuk();
        if (!adalahPemilik(saya)) return jawab({ pesan: 'bukan pemilik' }, 403, asal);
        const daftar = await env.DB.prepare(
          'SELECT kode_akhir, terbit, dibayar, rujukan, nominal, asal FROM kode_terbit ORDER BY terbit DESC LIMIT 200'
        ).all();
        const jumlah = await env.DB.prepare('SELECT COUNT(*) AS n FROM kode_terbit').first();
        const lunas = await env.DB.prepare('SELECT COUNT(*) AS n FROM kode_terbit WHERE dibayar IS NOT NULL').first();
        const nilai = await env.DB.prepare('SELECT COALESCE(SUM(nominal),0) AS n FROM kode_terbit WHERE dibayar IS NOT NULL').first();
        return jawab({ jumlah_terbit: jumlah.n, jumlah_lunas: lunas.n, nominal_lunas: nilai.n,
                       kode: daftar.results || [] }, 200, asal);
      }

      if (['GET', 'POST'].indexOf(request.method) === -1) {
        return jawab({ pesan: 'metode tidak diizinkan' }, 405, asal);
      }

      // ---- laporan funnel marketing (CSV/JSON, token) ----
      if (jalan === '/api/laporan/funnel' && request.method === 'GET') {
        const u = new URL(request.url);
        const token = u.searchParams.get('token') || (request.headers.get('X-Token') || '');
        if (!env.LAPORAN_TOKEN || token !== env.LAPORAN_TOKEN) return jawab({ pesan: 'token tidak sah' }, 403, asal);
        const day = Math.min(90, Math.max(1, parseInt(u.searchParams.get('hari') || '30', 10))) || 30;
        const cutoff = new Date(Date.now() - day*864e5).toISOString();
        const rows = await env.DB.prepare('SELECT waktu, jenis, rincian FROM peristiwa WHERE waktu >= ? AND is_test = 0 ORDER BY waktu DESC LIMIT 5000').bind(cutoff).all();
        const data = rows.results || [];
        if ((u.searchParams.get('format') || 'json') === 'csv') {
          const csv = ['waktu,jenis,rincian'].concat(data.map(r => [
            "\"" + r.waktu.replace(/\"/g,'\"\"') + "\"",
            "\"" + r.jenis.replace(/\"/g,'\"\"') + "\"",
            "\"" + (r.rincian||'').replace(/\"/g,'\"\"') + "\""
          ].join(','))).join('\n') + '\n';
          return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="funnel.csv"' } });
        }
        return jawab({ hari: day, hasil: data.map(r => ({ waktu: r.waktu, jenis: r.jenis, rincian: r.rincian || '' })) }, 200, asal);
      }

      // ---- dashboard funnel stats (public, untuk dashboard Pages) ----
      if (jalan === '/api/dashboard/stats' && request.method === 'GET') {
        const hariIni = new Date().toISOString().slice(0, 10);
        const kemarin = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
        const mingguLalu = new Date(Date.now() - 7*864e5).toISOString().slice(0, 10);
        
        const [kunjungan, klikBeli, pembayaranSukses, revenueHariIni, conversionRate] = await Promise.all([
          // Kunjungan unik hari ini (event kunjungan_beli)
          env.DB.prepare(
            "SELECT COUNT(DISTINCT rincian) AS n FROM peristiwa WHERE jenis = 'beli:kunjungan_beli' AND is_test = 0 AND substr(waktu,1,10) = ?"
          ).bind(hariIni).first(),
          // Klik CTA bayar hari ini
          env.DB.prepare(
            "SELECT COUNT(DISTINCT rincian) AS n FROM peristiwa WHERE jenis = 'beli:klik_cta_bayar' AND is_test = 0 AND substr(waktu,1,10) = ?"
          ).bind(hariIni).first(),
          // Pembayaran sukses hari ini (dari tabel payments, data test/audit dikeluarkan)
          env.DB.prepare(
            "SELECT COUNT(*) AS n, COALESCE(SUM(amount),0) AS total FROM payments WHERE status IN ('success','paid') AND is_test = 0 AND substr(timestamp,1,10) = ?"
          ).bind(hariIni).first(),
          // Revenue hari ini
          env.DB.prepare(
            "SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE status IN ('success','paid') AND is_test = 0 AND substr(timestamp,1,10) = ?"
          ).bind(hariIni).first(),
          // Conversion rate hari ini: pembayaran / kunjungan
          env.DB.prepare(
            "SELECT " +
            "  (SELECT COUNT(*) FROM payments WHERE status IN ('success','paid') AND is_test = 0 AND substr(timestamp,1,10) = ?) * 100.0 / " +
            "  NULLIF((SELECT COUNT(DISTINCT rincian) FROM peristiwa WHERE jenis = 'beli:kunjungan_beli' AND is_test = 0 AND substr(waktu,1,10) = ?), 0) AS rate"
          ).bind(hariIni, hariIni).first()
        ]);
        
        return jawab({
          hari: hariIni,
          kunjungan: kunjungan?.n || 0,
          klik_beli: klikBeli?.n || 0,
          pembayaran_sukses: pembayaranSukses?.n || 0,
          revenue_hari_ini: revenueHariIni?.total || 0,
          conversion_rate: conversionRate?.rate ? Number(conversionRate.rate.toFixed(2)) : 0
        }, 200, asal);
      }

      // ---- dashboard conversion detail (public) ----
      if (jalan === '/api/dashboard/conversion' && request.method === 'GET') {
        const u = new URL(request.url);
        const days = Math.min(30, Math.max(1, parseInt(u.searchParams.get('days') || '7', 10)));
        const cutoff = new Date(Date.now() - days*864e5).toISOString();
        
        const rows = await env.DB.prepare(
          "SELECT " +
          "  substr(waktu,1,10) AS hari, " +
          "  COUNT(DISTINCT CASE WHEN jenis = 'beli:kunjungan_beli' THEN rincian END) AS kunjungan, " +
          "  COUNT(DISTINCT CASE WHEN jenis = 'beli:klik_cta_bayar' THEN rincian END) AS klik_beli, " +
          "  (SELECT COUNT(*) FROM payments p WHERE p.status IN ('success','paid') AND p.is_test = 0 AND substr(p.timestamp,1,10) = substr(pe.waktu,1,10)) AS pembayaran, " +
          "  (SELECT COALESCE(SUM(amount),0) FROM payments p WHERE p.status IN ('success','paid') AND p.is_test = 0 AND substr(p.timestamp,1,10) = substr(pe.waktu,1,10)) AS revenue " +
          "FROM peristiwa pe " +
          "WHERE pe.waktu >= ? AND pe.jenis LIKE 'beli:%' AND pe.is_test = 0 " +
          "GROUP BY substr(pe.waktu,1,10) " +
          "ORDER BY hari DESC"
        ).bind(cutoff).all();
        
        const data = (rows.results || []).map(r => ({
          hari: r.hari,
          kunjungan: r.kunjungan || 0,
          klik_beli: r.klik_beli || 0,
          pembayaran: r.pembayaran || 0,
          revenue: r.revenue || 0,
          conversion_rate: r.kunjungan ? Number(((r.pembayaran / r.kunjungan) * 100).toFixed(2)) : 0
        }));
        
        return jawab({ days, data }, 200, asal);
      }

      // ---- CSV funnel harian: kunjungan /beli/ -> klik CTA -> bayar QRIS (peristiwa) + pembayaran (payments) ----
      // Baris per hari, hari tanpa data diisi nol. Gratis: baca langsung D1, tanpa layanan lain.
      if (jalan === '/api/dashboard/funnel-csv' && request.method === 'GET') {
        const u = new URL(request.url);
        const days = Math.min(90, Math.max(1, parseInt(u.searchParams.get('days') || '30', 10)));
        const sejak = new Date(Date.now() - (days - 1) * 864e5).toISOString().slice(0, 10);
        const [pe, pay] = await Promise.all([
          env.DB.prepare(
            "SELECT substr(waktu,1,10) AS hari, " +
            "COUNT(DISTINCT CASE WHEN jenis = 'beli:kunjungan_beli' THEN rincian END) AS kunjungan, " +
            "COUNT(DISTINCT CASE WHEN jenis = 'beli:klik_cta_bayar' THEN rincian END) AS klik " +
            "FROM peristiwa WHERE jenis LIKE 'beli:%' AND is_test = 0 AND substr(waktu,1,10) >= ? GROUP BY substr(waktu,1,10)"
          ).bind(sejak).all(),
          env.DB.prepare(
            "SELECT substr(timestamp,1,10) AS hari, COUNT(*) AS bayar, COALESCE(SUM(amount),0) AS revenue " +
            "FROM payments WHERE status IN ('success','paid') AND is_test = 0 AND substr(timestamp,1,10) >= ? GROUP BY substr(timestamp,1,10)"
          ).bind(sejak).all()
        ]);
        const mapHari = {};
        for (const r of (pe.results || [])) {
          mapHari[r.hari] = { kunjungan: r.kunjungan || 0, klik: r.klik || 0, bayar: 0, revenue: 0 };
        }
        for (const r of (pay.results || [])) {
          if (!mapHari[r.hari]) mapHari[r.hari] = { kunjungan: 0, klik: 0, bayar: 0, revenue: 0 };
          mapHari[r.hari].bayar = r.bayar || 0;
          mapHari[r.hari].revenue = r.revenue || 0;
        }
        const daftar = Object.keys(mapHari).sort().reverse();
        const csv = 'hari,kunjungan,klik_bayar,bayar_qris,konversi_pct,revenue_rp\n' + daftar.map(h => {
          const d = mapHari[h];
          const conv = d.kunjungan ? ((d.bayar / d.kunjungan) * 100).toFixed(2) : '0.00';
          return h + ',' + d.kunjungan + ',' + d.klik + ',' + d.bayar + ',' + conv + ',' + d.revenue;
        }).join('\n') + '\n';
        return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="funnel-harian.csv"' } });
      }

      // ---- funnel mingguan per kanal (webhook CSV + UTM): JSON + CSV terbuka ----
      // Kanal = utm_source. kunjungan dari beacon /api/pantau, pay dari webhook
      // QRIS/Tripay, kunjung-bayar = kuncian rujukan SP-xxx antara kedua sumber.
      if (jalan === '/api/dashboard/funnel-kanal' && request.method === 'GET') {
        const u = new URL(request.url);
        const days = Math.min(90, Math.max(1, parseInt(u.searchParams.get('days') || '7', 10) || 7));
        const data = await funnelKanalJson(env, days);
        if ((u.searchParams.get('format') || '') === 'csv') {
          const csv = 'kanal,kunjungan,kunjung_bayar,pay,revenue_rp\n' +
            data.kanal.map(k => [k.kanal, k.kunjungan, k.kunjung_bayar, k.pay, k.revenue_rp].join(',')).join('\n') +
            '\ntotal,' + [data.total.kunjungan, data.total.kunjung_bayar, data.total.pay, data.total.revenue_rp].join(',') + '\n';
          return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="funnel-kanal.csv"' } });
        }
        return jawab(data, 200, asal);
      }

      // ---- uji laporan mingguan manual (kode SAMA dengan cron Senin 07:00 WIB; ----
      //      guard KV TIDAK ditulis di jalur ini supaya ran cron asli tidak termakan) ----
      if (jalan === '/api/dashboard/mingguan-coba' && request.method === 'POST') {
        const ip = request.headers.get('CF-Connecting-IP') || 'tanpa-ip';
        const laju = await batasiLaju(env, ip, 'mingguan_coba', 5, 300);
        if (!laju.boleh) return jawab({ pesan: 'terlalu sering' }, 429, asal);
        const hasil = await laporanMingguan(env, { tanpaGuard: true });
        return jawab({ ok: !!hasil.ok, tg: hasil.tg, kanal: hasil.kanal || [], total: hasil.total || null }, 200, asal);
      }

      // ---- jalankan laporan harian Telegram secara manual (jalur kode sama dengan cron) ----
      if (jalan === '/api/dashboard/laporan-coba' && request.method === 'POST') {
        const hasil = await laporanHarian(env);
        return jawab({ ok: !!hasil.ok, tg: hasil.tg, ringkasan: hasil.ringkasan }, 200, asal);
      }

      // ---- uji cron rekonsiliasi pagi secara manual (kode sama dengan cron; guard KV
      //      rekons:pagi tetap berlaku, hapus kunci di KV untuk kirim ulang) ----
      if (jalan === '/api/dashboard/rekons-coba' && request.method === 'POST') {
        const u = new URL(request.url);
        const token = u.searchParams.get('token') || (request.headers.get('X-Token') || '');
        if (!env.LAPORAN_TOKEN || token !== env.LAPORAN_TOKEN) return jawab({ pesan: 'token tidak sah' }, 403, asal);
        const hasil = await rekonsCronPagi(env);
        return jawab({ ok: !!hasil.ok, terkirim: hasil.terkirim, lewati: hasil.lewati, jumlah_belum: hasil.jumlah_belum }, 200, asal);
      }

      // ---- uji alert revenue secara manual (kode SAMA dengan cron */10 dan
      //      ringkasan 07:00 WIB). mode=sweep memakai guard KV asli (lihat init
      //      dan dedup di sweepBayarBaru). mode=ringkasan kirim tanpa menulis guard
      //      supaya cron pagi tetap berjalan normal. ----
      if (jalan === '/api/dashboard/alert-coba' && request.method === 'POST') {
        const ip = request.headers.get('CF-Connecting-IP') || 'tanpa-ip';
        const laju = await batasiLaju(env, ip, 'alert_coba', 10, 300);
        if (!laju.boleh) return jawab({ pesan: 'terlalu sering' }, 429, asal);
        const mode = (new URL(request.url)).searchParams.get('mode') || 'sweep';
        const hasilAlert = mode === 'ringkasan'
          ? await ringkasanRevenuePagi(env, { tanpaGuard: true })
          : await sweepBayarBaru(env);
        return jawab(Object.assign({ mode: mode }, hasilAlert), 200, asal);
      }

      // ---- rekonsiliasi klaim "sudah bayar" vs pembayaran masuk (dasbor internal) ----
      // Autentikasi dua jalur: sesi pemilik ATAU token laporan (LAPORAN_TOKEN, jalur
      // yang sama dengan /api/laporan/funnel) supaya cron/ekspor dan pemilik bisa
      // memanggil tanpa login browser. Filter is_test selalu ikut kueri.
      if (jalan === '/api/rekonsiliasi-ringkasan' && request.method === 'GET') {
        const u = new URL(request.url);
        const token = u.searchParams.get('token') || (request.headers.get('X-Token') || '');
        const viaSesi = saya && adalahPemilik(saya);
        if (!viaSesi && (!env.LAPORAN_TOKEN || token !== env.LAPORAN_TOKEN))
          return jawab({ pesan: 'token tidak sah' }, 403, asal);
        const data = await rekonsiliasiRingkasan(env, u.searchParams.get('hari'));
        // CSV bukti run: ?format=csv — blok ringkasan + tabel klaim, untuk lampiran/holder.
        if ((u.searchParams.get('format') || '').toLowerCase() === 'csv') {
          const kutip = t => '"' + String(t == null ? '' : t).replace(/"/g, '""') + '"';
          const sek = [
            ['waktu_run', data.waktu], ['hari', data.hari],
            ['klaim_total', data.ringkasan.klaim_total],
            ['tercocok', data.ringkasan.tercocok],
            ['uji', data.ringkasan.uji],
            ['butuh_pemilik', data.ringkasan.butuh_pemilik],
            ['nominal_tercocok', data.ringkasan.nominal_tercocok],
            ['nominal_butuh_pemilik', data.ringkasan.nominal_klaim_tp]
          ];
          let csv = 'laporan,rekonsiliasi-ringkasan\n' +
            sek.map(x => x.map(kutip).join(',')).join('\n') +
            '\n\nrujukan,kode_akhir,nominal,kontak,klaim_waktu,status,alasan,nominal_masuk,tunggu_jam,payments\n' +
            (data.klaim || []).map(r => [
              r.rujukan, r.kode_akhir, r.nominal, r.kontak, r.klaim_waktu, r.status,
              r.alasan || '', r.nominal_masuk || 0, r.tunggu_jam,
              (r.payments || []).map(p => p.timestamp + '|' + p.amount + '|' + (p.txid || '')).join(' ')
            ].map(kutip).join(',')).join('\n') + '\n';
          const nama = 'rekonsiliasi-run-' + String(data.waktu).slice(0, 10) + '.csv';
          return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="' + nama + '"' } });
        }
        return jawab(data, 200, asal);
      }

      // ---- dashboard funnel harian 1-URL (JSON terbuka, tanpa login) ----
      // Sumber utama: snapshot KV yang diperbarui cron tiap 6 jam. Kalau snapshot
      // belum ada (KV kosong/baru dibuat), hitung langsung dari D1 dan sekalian
      // simpan sebagai snapshot supaya kunjungan berikutnya sudah terlayani dari KV.
      if (jalan === '/api/funnel' && request.method === 'GET') {
        // ?segar=1 memaksa hitung ulang dari D1 dan menimpa snapshot (untuk audit/debug).
        const paksaSegar = new URL(request.url).searchParams.get('segar') === '1';
        let snap = null;
        try { if (!paksaSegar) snap = await env.FUNNEL_KV.get('funnel:terkini'); } catch (e) { snap = null; }
        if (snap) {
          let data;
          try { data = JSON.parse(snap); } catch (e) { data = null; }
          // Snapshot hanya ditulis cron jam 00/06/12/18 UTC, jadi dashboard bisa basi sampai 6 jam
          // (mis. pukul 07:58 masih menyajikan angka 06:10). Bila snapshot lebih tua dari 2 jam,
          // hitung ulang dari D1 lalu tulis balik — dashboard pulih sendiri tanpa cron tambahan.
          const umurJam = data && data.waktu_snapshot
            ? (Date.now() - new Date(data.waktu_snapshot).getTime()) / 3600e3 : Infinity;
          if (data && umurJam <= 2) return jawab(data, 200, asal);
          if (data) {
            const segar = await funnelHarianJson(env);
            try { await env.FUNNEL_KV.put('funnel:terkini', JSON.stringify(Object.assign(segar, { sumber: 'snapshot-kv' }))); } catch (e) {}
            segar.sumber = 'live-d1';
            segar.snapshot_sebelumnya = data.waktu_snapshot;
            return jawab(segar, 200, asal);
          }
        }
        const data = await funnelHarianJson(env);
        try {
          const tersimpan = Object.assign({}, data, { sumber: 'snapshot-kv' });
          await env.FUNNEL_KV.put('funnel:terkini', JSON.stringify(tersimpan));
        } catch (e) { /* KV gagal: tetap sajikan angka langsung dari D1 */ }
        data.sumber = 'live-d1';
        return jawab(data, 200, asal);
      }

      // ---- dashboard A/B /beli/ 1-URL (JSON terbuka; ?format=csv untuk ekspor) ----
      // Membaca sumber yang sama dengan CSV funnel + webhook yang sudah ada: tabel
      // peristiwa (beacon /api/pantau, rincian 'SP-123|var:a' — tag varian t_84585ee0)
      // dan payments (webhook QRIS/Tripay, kolom rujukan). Hanya SELECT — wiring
      // pembayaran tidak disentuh, pembayaran baru tetap 100% tercatat di webhook.
      if (jalan === '/api/ab-beli' && request.method === 'GET') {
        const u = new URL(request.url);
        const days = Math.min(90, Math.max(1, parseInt(u.searchParams.get('days') || '7', 10) || 7));
        const data = await abBeliJson(env, days);
        if ((u.searchParams.get('format') || '') === 'csv') {
          const pct = (x, n) => (n ? ((x / n) * 100).toFixed(2) : '0.00');
          const baris = (nama, d) => [nama, d.kunjungan, d.klik_bayar, d.qris_dibuat, d.bayar_sukses, d.revenue_rp, pct(d.klik_bayar, d.kunjungan), pct(d.bayar_sukses, d.kunjungan)].join(',');
          const csv = 'varian,kunjungan,klik_bayar,qris_dibuat,bayar_sukses,revenue_rp,klik_pct,bayar_pct\n' +
            baris('a', data.varian.a) + '\n' + baris('b', data.varian.b) + '\n' +
            baris('tanpa_tag', data.tanpa_tag_varian) + '\n' + baris('total', data.total) + '\n';
          return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="ab-beli.csv"' } });
        }
        return jawab(data, 200, asal);
      }

      if (jalan === '/' || jalan === '/sehat') {
              return jawab({ aplikasi: 'SiapPsikotes API', keadaan: 'hidup', waktu: new Date().toISOString() }, 200, asal);
            }

            // ---- Program referensi (mekanisme FINAL marketing): ringkasan untuk pemilik ----
            // Kode REF-XXXX lahir otomatis dari pembayaran sukses (bukan dari login); angka
            // pemakaian dihitung dari referral_konversi: status 'checkout' = diskon dipakai,
            // status 'reward' = pembayaran sukses lewat kode (+30 hari untuk referrer).
            if (jalan === '/api/pemilik/referensi' && request.method === 'GET') {
              if (!saya) return perluMasuk();
              if (!adalahPemilik(saya)) return jawab({ pesan: 'bukan pemilik' }, 403, asal);
              const daftar = await env.DB.prepare(
                'SELECT rk.kode, rk.payment_id, rk.dibuat_at, rk.klaim_bulan_ini, rk.reward_hari, ' +
                "(SELECT COUNT(*) FROM referral_konversi kk WHERE kk.kode = rk.kode AND kk.status = 'checkout') AS checkout, " +
                "(SELECT COUNT(*) FROM referral_konversi kk WHERE kk.kode = rk.kode AND kk.status = 'reward') AS reward " +
                'FROM referral_kode rk ORDER BY rk.dibuat_at DESC LIMIT 200'
              ).all();
              const ringkas = await env.DB.prepare(
                'SELECT status, COUNT(*) AS n FROM referral_konversi GROUP BY status'
              ).all();
              return jawab({ kode: daftar.results || [], konversi: ringkas.results || [] }, 200, asal);
            }

            // ---- Premium check ----
            if (jalan === '/premium' && request.method === 'GET') {
              if (!saya) return jawab({ premium: false }, 401, asal);
              const has = await env.DB.prepare('SELECT 1 FROM pembelian WHERE pengguna = ? LIMIT 1').bind(saya.id).first();
              return jawab({ premium: !!has }, 200, asal);
            }

            // ---- Monitoring health check /beli/ (dijalankan otomatis via Cron Trigger tiap 10 menit) ----
            if (jalan === '/api/monitoring/status' && request.method === 'GET') {
              const u = new URL(request.url);
              const limit = Math.min(50, Math.max(1, parseInt(u.searchParams.get('limit') || '10', 10)));
              const rows = await env.DB.prepare(
                'SELECT waktu, endpoint, status, ok_qris, ok_turnstile, ok_cta, latency_ms, rincian, alert_terkirim FROM monitoring_checks ORDER BY waktu DESC LIMIT ?'
              ).bind(limit).all();
              return jawab({ checks: rows.results || [] }, 200, asal);
            }

            // ---- Comprehensive monitoring status (latest run) ----
            if (jalan === '/api/monitoring/status-full' && request.method === 'GET') {
              const hasil = await cekMonitoringLengkap(env);
              return jawab({ ok: hasil.ok, waktu: new Date().toISOString(), beli: hasil.beli, funnel: hasil.funnel, tripay: hasil.tripay, rincian: hasil.rincian, mode_funnel: hasil.mode_funnel, alert: hasil.alert }, 200, asal);
            }

            // ---- Manual monitoring test endpoint (POST) ----
            if (jalan === '/api/monitoring/test' && request.method === 'POST') {
              const hasil = await cekMonitoringLengkap(env);
              return jawab({ ok: hasil.ok, rincian: hasil.rincian, beli: hasil.beli, funnel: hasil.funnel, tripay: hasil.tripay, mode_funnel: hasil.mode_funnel, alert: hasil.alert }, 200, asal);
            }

            return jawab({ pesan: 'alamat tidak dikenal' }, 404, asal);

          } catch (e) {
            return jawab({ pesan: 'permintaan tidak bisa diproses', rincian: String(e.message || e).slice(0, 160) }, 400, asal);
          }
        },
        async scheduled(event, env, ctx) {
              // "*/10 * * * *" => cek monitoring, plus snapshot funnel harian ke KV tiap 6 jam
              //   (jam 00/06/12/18 UTC, run menit 0-10) untuk dashboard 1-URL GET /api/funnel.
              // "55 16 * * *" => laporan funnel harian ke Telegram (23:55 WIB).
              // Rekonsiliasi pagi 08:00 WIB TIDAK memakai cron trigger baru (akun free sudah
              // genap 5 cron trigger): dijadwalkan dari kode saat cron */10 jatuh di jam 8 WIB,
              // guard KV rekons:pagi:<tanggal-WIB> memastikan hanya ran 08:00-08:59 pertama
              // yang mengirim. Uji manual: POST /api/dashboard/rekons-coba.
              if (event.cron === '55 16 * * *') { await laporanHarian(env); return; }
              const kini = new Date();
              if ((new Date(Date.now() + 7 * 3600e3)).getUTCHours() === 8) await rekonsCronPagi(env);
              if ((new Date(Date.now() + 7 * 3600e3)).getUTCHours() === 7) await ringkasanRevenuePagi(env);
              await sweepBayarBaru(env);   // alert revenue: bayar baru -> push Telegram (guard KV rowid, tiap bayar sekali)
              // Fallback tanpa Tripay (t_3a03d4b4): klaim "sudah bayar" tertunda dicocokkan
              // tiap 10 menit dengan muatan webhook yang mungkin masuk belakangan — janji
              // copy "aktif maksimal 15 menit" dipegang ini + pencocokan saat tombol tekan.
              await selesaikanKlaimTertunda(env);
              // Laporan funnel mingguan per kanal (webhook+UTM): Senin 07:00 WIB. Dijadwalkan
              // dari cron */10 yang SUDAH ada (menit pertama rentang 07:00-07:59 WIB menang,
              // lalu guard KV menahan yang lain) — nol trigger cron baru.
              const wibCron = new Date(Date.now() + 7 * 3600e3);
              if (wibCron.getUTCHours() === 7 && wibCron.getUTCDay() === 1) await laporanMingguan(env);
              if (kini.getUTCHours() % 6 === 0 && kini.getUTCMinutes() <= 10) await simpanSnapshotFunnel(env);
              await ingatkanTripayBelumPasang(env);   // sekali sehari saja, lihat fungsinya
              await cekMonitoringLengkap(env);
            }
      };

      // ===== Monitoring /beli/ =====
          const MONITOR_ENDPOINT = 'https://siappsikotes.my.id/beli/';
              // FUNNEL_API akan dibangun di fungsi cekFunnelCSV menggunakan env.LAPORAN_TOKEN
              const TRIPAY_WEBHOOK_URL = ''; // Belum dikonfigurasi - static QRIS manual
              const TG_BOT_TOKEN = '8649638758:***'; // placeholder, akan diganti via secret
              const TG_CHAT_ID = '7809584261';

          async function kirimTelegramAlert(env, pesan) {
              const token = env.TG_BOT_TOKEN || TG_BOT_TOKEN;
              const chatId = env.TG_CHAT_ID || TG_CHAT_ID;
              if (!token || token === TG_BOT_TOKEN) return { ok: false, reason: 'token tidak dikonfigurasi' };
              try {
                  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ chat_id: chatId, text: pesan, parse_mode: 'HTML' })
                  });
                  let message_id = null, chat_terkirim = null;
                  try { const d = await r.json(); if (d && d.result) { message_id = d.result.message_id || null; chat_terkirim = (d.result.chat && d.result.chat.id) || null; } } catch (e) {}
                  return { ok: r.ok, status: r.status, message_id, chat_id: chat_terkirim };
              } catch (e) {
                  return { ok: false, reason: String(e.message || e).slice(0, 100) };
              }
          }

          // Cek kesehatan pipeline funnel. Dulu fungsi ini menyimpulkan "GAGAL - Funnel data
          // kosong" bila tak ada event dalam 2 hari, sehingga situs yang sekadar SEPI kunjungan
          // memicu alert Telegram tiap 10 menit tanpa henti. Sekarang dibedakan:
          //   - trafik  : ada event nyata (is_test=0) <= 28 jam  -> sehat
          //   - idle    : tak ada event nyata, tapi pipeline DIBUKTIKAN hidup lewat event kanari
          //               (jenis 'monitor:kanari', is_test=1, tidak masuk metrik funnel mana pun)
          //   - gagal   : tulis/baca D1 gagal, atau kode pelacak hilang dari script.js
                  async function cekFunnelCSV(env) {
                      const AMBANG_JAM = 28;
                      try {
                          const cut28 = new Date(Date.now() - AMBANG_JAM * 3600e3).toISOString();
                          const cut7 = new Date(Date.now() - 7 * 864e5).toISOString();
                          const [segar, mingguan] = await Promise.all([
                              env.DB.prepare("SELECT waktu FROM peristiwa WHERE is_test = 0 AND waktu >= ? ORDER BY waktu DESC LIMIT 1").bind(cut28).first(),
                              env.DB.prepare("SELECT COUNT(*) AS n FROM peristiwa WHERE is_test = 0 AND jenis LIKE 'beli:%' AND waktu >= ?").bind(cut7).first()
                          ]);
                          const n7 = (mingguan && mingguan.n) || 0;
                          if (segar && segar.waktu) {
                              const jamLalu = (Date.now() - new Date(segar.waktu).getTime()) / 3600e3;
                              return { ok: true, status: 200, mode: 'trafik', jumlah_7hari: n7,
                                       rincian: 'OK (event ' + jamLalu.toFixed(1) + ' jam lalu, ' + n7 + ' event 7 hari)' };
                          }

                          // Tak ada kunjungan nyata: jangan langsung menuduh rusak. Buktikan dulu
                          // bahwa jalur tulis+baca peristiwa masih hidup dengan satu event kanari.
                          // Kanari dipakai ulang bila masih < 1 jam supaya kuota tulis D1 tidak terkuras
                          // (cron jalan tiap 10 menit).
                          const kini = new Date().toISOString();
                          const cut1 = new Date(Date.now() - 3600e3).toISOString();
                          const kanariBaru = await env.DB.prepare(
                              "SELECT id, waktu FROM peristiwa WHERE utm_source = 'monitor-kanari' AND waktu >= ? ORDER BY id DESC LIMIT 1"
                          ).bind(cut1).first();
                          let baca = kanariBaru || null;
                          if (!baca) {
                              const ins = await env.DB.prepare(
                                  'INSERT INTO peristiwa (pengguna, jenis, rincian, waktu, utm_source, utm_medium, utm_campaign, is_test) VALUES (NULL, ?, ?, ?, ?, ?, ?, 1)'
                              ).bind('monitor:kanari', 'pipeline', kini, 'monitor-kanari', 'cron', 'cek-funnel').run();
                              const idKanari = ins && ins.meta && ins.meta.last_row_id;
                              baca = idKanari
                                  ? await env.DB.prepare('SELECT id, waktu FROM peristiwa WHERE id = ?').bind(idKanari).first()
                                  : null;
                          }
                          try {
                              // Kanari hanya penanda hidup; simpan maksimal 2 hari supaya tabel tidak menggelembung.
                              await env.DB.prepare("DELETE FROM peristiwa WHERE utm_source = 'monitor-kanari' AND waktu < ?")
                                  .bind(new Date(Date.now() - 2 * 864e5).toISOString()).run();
                          } catch (e) {}
                          if (!baca) return { ok: false, status: 200, mode: 'kanari',
                                              rincian: 'Pipeline tulis/baca gagal (kanari tidak terbaca)' };
                          const umurKanari = ((Date.now() - new Date(baca.waktu).getTime()) / 60000).toFixed(0);

                          // Jalur ingress (beacon di peramban) tetap diperiksa: kalau skrip pelacak
                          // hilang dari /beli/script.js, kunjungan nyata tak akan pernah tercatat.
                          try {
                              const r = await fetch('https://siappsikotes.my.id/beli/script.js?cek=' + Date.now(), {
                                  headers: { 'User-Agent': 'SiapPsikotes-Monitor/1.0' },
                                  cf: { cacheTtl: 0, cacheEverything: false }
                              });
                              const js = await r.text();
                              if (!/kunjungan_beli/.test(js) || !/\/api\/pantau/.test(js))
                                  return { ok: false, status: r.status, mode: 'pelacak',
                                           rincian: 'Pelacak hilang dari script.js (HTTP ' + r.status + ')' };
                          } catch (e) {
                              return { ok: false, status: 0, mode: 'pelacak',
                                       rincian: 'script.js tak terbaca: ' + String(e.message || e).slice(0, 80) };
                          }

                          return { ok: true, status: 200, mode: 'idle', jumlah_7hari: n7,
                                   rincian: 'idle: tanpa kunjungan nyata ' + AMBANG_JAM + ' jam, pipeline terverifikasi (kanari ' + umurKanari + ' mnt + pelacak OK)' };
                      } catch (e) {
                          return { ok: false, status: 0, rincian: 'Funnel error: ' + String(e.message || e).slice(0, 120) };
                      }
                  }

          // Laporan funnel harian ke Telegram admin: kunjungan /beli/ -> klik -> bayar QRIS (7 hari terakhir)
          // Dijalankan cron harian (23:55 WIB) dan bisa juga manual via POST /api/dashboard/laporan-coba
          async function laporanHarian(env) {
              try {
                  const sejak = new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10);
                  const [pe, pay] = await Promise.all([
                      env.DB.prepare(
                          "SELECT substr(waktu,1,10) AS hari, " +
                          "COUNT(DISTINCT CASE WHEN jenis = 'beli:kunjungan_beli' THEN rincian END) AS kunjungan, " +
                          "COUNT(DISTINCT CASE WHEN jenis = 'beli:klik_cta_bayar' THEN rincian END) AS klik " +
                          "FROM peristiwa WHERE jenis LIKE 'beli:%' AND is_test = 0 AND substr(waktu,1,10) >= ? GROUP BY substr(waktu,1,10)"
                      ).bind(sejak).all(),
                      env.DB.prepare(
                          "SELECT substr(timestamp,1,10) AS hari, COUNT(*) AS bayar, COALESCE(SUM(amount),0) AS revenue " +
                          "FROM payments WHERE status IN ('success','paid') AND is_test = 0 AND substr(timestamp,1,10) >= ? GROUP BY substr(timestamp,1,10)"
                      ).bind(sejak).all()
                  ]);
                  const mapHari = {};
                  for (const r of (pe.results || [])) {
                      mapHari[r.hari] = { kunjungan: r.kunjungan || 0, klik: r.klik || 0, bayar: 0, revenue: 0 };
                  }
                  for (const r of (pay.results || [])) {
                      if (!mapHari[r.hari]) mapHari[r.hari] = { kunjungan: 0, klik: 0, bayar: 0, revenue: 0 };
                      mapHari[r.hari].bayar = r.bayar || 0;
                      mapHari[r.hari].revenue = r.revenue || 0;
                  }
                  const daftar = Object.keys(mapHari).sort().reverse();
                  let totalV = 0, totalK = 0, totalB = 0, rev = 0;
                  const baris = daftar.map(h => {
                      const d = mapHari[h];
                      totalV += d.kunjungan; totalK += d.klik; totalB += d.bayar; rev += d.revenue;
                      const conv = d.kunjungan ? ((d.bayar / d.kunjungan) * 100).toFixed(1) + '%' : '-';
                      return h + ' · kunjungan ' + d.kunjungan + ' · klik ' + d.klik + ' · bayar ' + d.bayar + ' · ' + conv + ' · Rp ' + Number(d.revenue).toLocaleString('id-ID');
                  }).join('\n');
                  const convTotal = totalV ? ((totalB / totalV) * 100).toFixed(1) + '%' : '-';
            // ===== Rekonsiliasi klaim "sudah bayar" (jalur B tanpa Tripay) =====
            // Klaim yang belum ketemu muatan webhook-nya (asal='klaim'; yang cocok sudah naik ke
            // 'klaim-webhook' oleh pencocokan instan/cron */10) dihadapkan status laporan:
            // yang tak pernah ketemu pembayaran nyata perlu rekonsiliasi manual pemilik (mutasi QRIS).
            let rekonsiliasi = 'Klaim "sudah bayar": tidak ada dalam 7 hari.';
            try {
                const [klaim, masuk] = await Promise.all([
                    env.DB.prepare("SELECT rujukan, nominal, dibayar FROM kode_terbit WHERE asal = 'klaim' AND dibayar IS NOT NULL AND dibayar >= ? ORDER BY dibayar DESC LIMIT 100").bind(sejak).all(),
                    env.DB.prepare("SELECT DISTINCT rujukan FROM payments WHERE status IN ('success','paid') AND is_test = 0 AND rujukan IS NOT NULL AND timestamp >= ?").bind(sejak).all()
                ]);
                const sah = new Set((masuk.results || []).map(r => r.rujukan));
                const belum = (klaim.results || []).filter(k => !sah.has(k.rujukan));
                if ((klaim.results || []).length) {
                    rekonsiliasi = belum.length === 0
                        ? 'Klaim "sudah bayar": ' + klaim.results.length + ' — semua terkonfirmasi pembayaran masuk ✓'
                        : '⚠️ Klaim TANPA pembayaran tercatat (rekonsiliasi manual):\n' +
                          belum.map(k => '• ' + k.rujukan + ' — Rp ' + Number(k.nominal).toLocaleString('id-ID') +
                                        ' (klaim ' + String(k.dibayar).slice(0, 16).replace('T', ' ') + ' UTC)').join('\n');
                }
            } catch (e) { rekonsiliasi = 'Rekonsiliasi gagal dihitung: ' + String(e.message || e).slice(0, 80); }
            const pesan = `<b>📊 Funnel /beli/ — 7 hari terakhir</b>\n` +
                (baris || '(belum ada data)') +
                `\n\nTotal: kunjungan ${totalV} · klik ${totalK} · bayar ${totalB} · konversi ${convTotal} · Rp ${Number(rev).toLocaleString('id-ID')}` +
                `\n\n<b>🧾 ${rekonsiliasi}</b>` +
                `\nCSV: https://siappsikotes-api.rasyidahmad180.workers.dev/api/dashboard/funnel-csv`;
            const tg = await kirimTelegramAlert(env, pesan);
            return { ok: !!tg.ok, tg, ringkasan: baris || '(belum ada data)' };
              } catch (e) {
            return { ok: false, ringkasan: String(e.message || e).slice(0, 160) };
            }
            }

            // ===== Funnel mingguan per kanal (sumber: webhook CSV + UTM beacon) =====
            // Gabungan DUA sumber yang sudah ada, gratis, tanpa kolom/migrasi baru:
            //   - peristiwa (beacon /api/pantau): kunjungan /beli/, kolom utm_source = kanal kampanye
            //   - payments  (webhook QRIS/Tripay): pembayaran sukses, utm_source ikut webhook
            // Kanal = utm_source; baris '-' = tanpa UTM (direct). kunjung-bayar = rujukan SP-xxx
            // yang PUNYA event kunjungan DAN pembayaran sukses — atribusinya mengikuti kanal
            // kunjungan (kanal pertama yang terlihat menang, pola sama dengan abBeliJson);
            // pembayaran yang rujukannya tidak pernah terlihat di beacon dilaporkan terpisah
            // (total.bayar_tanpa_kunjungan) supaya tidak ada uang yang hilang dari laporan.
            async function funnelKanalJson(env, jmlHari) {
                const jumlah = Math.min(90, Math.max(1, parseInt(jmlHari, 10) || 7)) || 7;
                const sejak = new Date(Date.now() - (jumlah - 1) * 864e5).toISOString().slice(0, 10);
                const [pe, pay] = await Promise.all([
                    env.DB.prepare(
                        "SELECT utm_source, rincian FROM peristiwa WHERE jenis = 'beli:kunjungan_beli' " +
                        "AND is_test = 0 AND substr(waktu,1,10) >= ? LIMIT 20000"
                    ).bind(sejak).all(),
                    env.DB.prepare(
                        "SELECT COALESCE(utm_source,'') AS kanal, rujukan, amount FROM payments " +
                        "WHERE status IN ('success','paid') AND is_test = 0 AND substr(timestamp,1,10) >= ? ORDER BY timestamp ASC LIMIT 5000"
                    ).bind(sejak).all()
                ]);
                const hilangTag = (r) => {
                    // rincian beacon bisa bernada 'SP-123|var:a' (tag varian A/B) — tag dibuang
                    // supaya satu rujukan tetap satu rujukan saat disandingkan dengan webhook.
                    const m = /^(SP-\d{3})\|var:[ab]$/.exec(String(r || '').toUpperCase().trim());
                    return m ? m[1] : String(r || '').toUpperCase().trim();
                };
                const kotak = {};   // kanal -> { kunjungan, kunjung_bayar, pay, revenue_rp }
                const atur = (k) => {
                    k = (k ? String(k).slice(0, 50).trim() : '') || '-';
                    if (!kotak[k]) kotak[k] = { kanal: k, kunjungan: 0, kunjung_bayar: 0, pay: 0, revenue_rp: 0 };
                    return kotak[k];
                };
                // Kunjungan unik per kanal (distinct rincian — konsisten COUNT(DISTINCT) dashboard lain)
                const setRincian = {};
                const kanalRujukan = {};
                for (const r of (pe.results || [])) {
                    const k = (r.utm_source ? String(r.utm_source) : '') || '-';
                    setRincian[k] = setRincian[k] || {};
                    setRincian[k][String(r.rincian || '')] = 1;
                    atur(k);
                    const rj = hilangTag(r.rincian);
                    if (rj && rj.indexOf('SP-') === 0 && !kanalRujukan[rj]) kanalRujukan[rj] = k;
                }
                for (const k in setRincian) kotak[k].kunjungan = Object.keys(setRincian[k]).length;
                const dibayar = {};
                for (const p of (pay.results || [])) {
                    const d = atur(p.kanal);
                    d.pay++;
                    d.revenue_rp += Math.round(Number(p.amount) || 0);
                    const rj = hilangTag(p.rujukan);
                    if (rj && rj.indexOf('SP-') === 0) dibayar[rj] = 1;
                }
                const sesibayar = {};
                for (const rj in dibayar) {
                    const k = kanalRujukan[rj];
                    if (k) sesibayar[k] = (sesibayar[k] || 0) + 1;
                }
                for (const k in sesibayar) if (kotak[k]) kotak[k].kunjung_bayar = sesibayar[k];
                const daftar = Object.keys(kotak).map(k => kotak[k]).sort((x, y) => (y.pay - x.pay) || (y.kunjungan - x.kunjungan));
                const total = { kunjungan: 0, kunjung_bayar: 0, pay: 0, revenue_rp: 0, bayar_tanpa_kunjungan: 0 };
                for (const d of daftar) {
                    total.kunjungan += d.kunjungan;
                    total.kunjung_bayar += d.kunjung_bayar;
                    total.pay += d.pay;
                    total.revenue_rp += d.revenue_rp;
                }
                for (const rj in dibayar) if (!kanalRujukan[rj]) total.bayar_tanpa_kunjungan++;
                return {
                    aplikasi: 'SiapPsikotes',
                    judul: 'Funnel mingguan /beli/ per kanal (utm_source)',
                    waktu: new Date().toISOString(),
                    zona_hari: 'UTC',
                    jendela: { hari: jumlah, sejak: sejak },
                    definisi: {
                        kunjungan: 'pengunjung unik /beli/ per utm_source (beacon kunjungan_beli)',
                        kunjung_bayar: 'rujukan yang kunjungan dan bayar; kanal diambil dari kanal kunjingannya',
                        pay: 'webhook pembayaran success|paid is_test=0 per utm_source',
                        revenue_rp: 'jumlah nominal pembayaran per kanal',
                        bayar_tanpa_kunjungan: 'rujukan dibayar yang tidak pernah terlihat di beacon'
                    },
                    kanal: daftar,
                    total: total
                };
            }

            // Laporan funnel mingguan per kanal ke Telegram admin: Senin 07:00 WIB.
            // Guard KV 'laporan:mingguan:<senin-WIB>' memastikan sekali per minggu. Uji manual:
            // POST /api/dashboard/mingguan-coba (melewati guard; guard cron asli tetap utuh).
            async function laporanMingguan(env, opsi) {
                const tanpaGuard = !!(opsi && opsi.tanpaGuard);
                try {
                    const wib = new Date(Date.now() + 7 * 3600e3);
                    const mundur = (wib.getUTCDay() + 6) % 7;   // hari Senin pada minggu berjalan
                    const seninWIB = new Date(wib.getTime() - mundur * 864e5).toISOString().slice(0, 10);
                    const KUNCI = 'laporan:mingguan:' + seninWIB;
                    if (!tanpaGuard && (await env.FUNNEL_KV.get(KUNCI))) {
                        return { ok: true, lewati: 'minggu ini sudah dikirim', senin: seninWIB };
                    }
                    const data = await funnelKanalJson(env, 7);
                    const garis = data.kanal.map(k =>
                        bersihTeks(k.kanal) + ': kunjungan ' + k.kunjungan + ' · kunjung-bayar ' + k.kunjung_bayar +
                        ' · pay ' + k.pay + ' · Rp ' + Number(k.revenue_rp).toLocaleString('id-ID')).join('\n');
                    const pesan = '<b>📊 Funnel mingguan SiapPsikotes — per kanal (UTM)</b>\n' +
                        'Periode 7 hari s/d ' + data.jendela.sejak + '..' + new Date().toISOString().slice(0, 10) + ' UTC\n\n' +
                        (garis || '(belum ada kanal)') + '\n\n' +
                        'Total: kunjungan ' + data.total.kunjungan + ' · kunjung-bayar ' + data.total.kunjung_bayar +
                        ' · pay ' + data.total.pay + ' · Rp ' + Number(data.total.revenue_rp).toLocaleString('id-ID') +
                        '\nbayar tanpa kunjungan tercatat: ' + data.total.bayar_tanpa_kunjungan +
                        '\nCSV: https://siappsikotes-api.rasyidahmad180.workers.dev/api/dashboard/funnel-kanal?days=7&format=csv';
                    const tg = await kirimTelegramAlert(env, pesan);
                    if (tg.ok && !tanpaGuard) {
                        try { await env.FUNNEL_KV.put(KUNCI, JSON.stringify({ waktu: new Date().toISOString(), message_id: tg.message_id || null })); } catch (e) {}
                    }
                    return { ok: !!tg.ok, tg, senin: seninWIB, kanal: data.kanal, total: data.total, pesan: pesan };
                } catch (e) {
                    return { ok: false, rincian: String(e.message || e).slice(0, 160) };
                }
            }

            // ===== Alert revenue: push Telegram tiap bayar baru + ringkasan pagi 07:00 WIB =====
            // Sumber: tabel payments (webhook QRIS manual + webhook Tripay). Guard KV
            // 'alert:pay:last_rowid' memastikan tiap baris hanya di-push SEKALI oleh sweep;
            // sweep menutup celah jalur yang tidak push instan (Tripay PAID, webhook gagal).
            // Baris is_test=1 tetap di-push tapi ditandai [UJI] dan TIDAK masuk metrik revenue.
            // Uji manual: POST /api/dashboard/alert-coba (mode=sweep|ringkasan).
            async function bersihTeks(s) {
                return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            }

            async function sweepBayarBaru(env) {
                const KUNCI = 'alert:pay:last_rowid';
                try {
                    let terakhir = parseInt(await env.FUNNEL_KV.get(KUNCI), 10);
                    if (!Number.isFinite(terakhir) || terakhir < 0) {
                        // Penyalaan pertama: jangan memutar ulang riwayat pembayaran lama —
                        // mulai dari baris terbaru yang sudah ada.
                        const m = await env.DB.prepare('SELECT COALESCE(MAX(rowid),0) AS mx FROM payments').first();
                        terakhir = (m && m.mx) || 0;
                        await env.FUNNEL_KV.put(KUNCI, String(terakhir));
                        return { ok: true, inisialisasi: true, terakhir: terakhir, dikirim: 0 };
                    }
                    const rows = await env.DB.prepare(
                        "SELECT rowid AS id, timestamp, product, amount, status, txid, utm_source, is_test, rujukan " +
                        "FROM payments WHERE rowid > ? AND status IN ('success','paid') ORDER BY rowid ASC LIMIT 10"
                    ).bind(terakhir).all();
                    const baru = rows.results || [];
                    if (!baru.length) return { ok: true, dikirim: 0, terakhir: terakhir };
                    let terjauhSukses = terakhir;
                    const hasil = [];
                    for (const p of baru) {
                        const uji = p.is_test === 1 || p.is_test === '1';
                        const pesan = (uji ? '🧪 <b>[UJI] Pembayaran Baru</b>' : '✅ <b>Pembayaran Baru</b>') +
                            '\nProduk: ' + bersihTeks(p.product) +
                            '\nJumlah: Rp ' + Number(p.amount).toLocaleString('id-ID') +
                            '\nStatus: ' + bersihTeks(p.status) +
                            (p.rujukan ? '\nRujukan: ' + bersihTeks(p.rujukan) : '') +
                            '\nTXID: ' + bersihTeks(p.txid || '-') +
                            '\nUTM: ' + bersihTeks(p.utm_source || '-') +
                            '\nWaktu: ' + bersihTeks(p.timestamp) + ' UTC';
                        const tg = await kirimTelegramAlert(env, pesan);
                        hasil.push({ id: p.id, uji: uji, tg_ok: !!tg.ok, status: tg.status, message_id: tg.message_id || null, alasan: tg.reason || null });
                        if (!tg.ok) break;   // gagal kirim: berhenti — baris ini diulang sweep berikutnya (tidak ada alert hilang)
                        terjauhSukses = p.id;
                    }
                    await env.FUNNEL_KV.put(KUNCI, String(terjauhSukses));
                    const sukses = hasil.filter(h => h.tg_ok).length;
                    return { ok: true, dikirim: sukses, sisa: baru.length - sukses, terakhir: terjauhSukses, hasil: hasil };
                } catch (e) {
                    return { ok: false, rincian: String(e.message || e).slice(0, 160) };
                }
            }

            // Ringkasan revenue harian 07:00 WIB: angka kemarin WIB + hari ini s/d 07:00 + 7 hari.
            // Guard KV 'alert:ringkas:<tanggal-WIB>' sekali sehari. Uji manual:
            // POST /api/dashboard/alert-coba?mode=ringkasan (kirim tanpa menulis guard, supaya
            // cron pagi tetap berjalan normal).
            async function ringkasanRevenuePagi(env, opsi) {
                const tanpaGuard = !!(opsi && opsi.tanpaGuard);
                try {
                    const tanggalWIB = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
                    const KUNCI = 'alert:ringkas:' + tanggalWIB;
                    if (!tanpaGuard && (await env.FUNNEL_KV.get(KUNCI))) {
                        return { ok: true, lewati: 'sudah dikirim hari ini', tanggal: tanggalWIB };
                    }
                    const tengahMalamWIB = Date.parse(tanggalWIB + 'T00:00:00Z') - 7 * 3600e3; // UTC ms dari 00:00 WIB hari ini
                    const mulaiKemarin = new Date(tengahMalamWIB - 864e5).toISOString();
                    const mulaiHariIni = new Date(tengahMalamWIB).toISOString();
                    const sejak7 = new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10);
                    const satu = (dari, sampai) => env.DB.prepare(
                        "SELECT COUNT(*) AS n, COALESCE(SUM(amount),0) AS total FROM payments " +
                        "WHERE status IN ('success','paid') AND is_test = 0 AND timestamp >= ? AND timestamp < ?"
                    ).bind(dari, sampai).first();
                    const [kemarin, hariIni, tujuh] = await Promise.all([
                        satu(mulaiKemarin, mulaiHariIni),
                        satu(mulaiHariIni, new Date(Date.now() + 60e3).toISOString()),
                        env.DB.prepare(
                            "SELECT COUNT(*) AS n, COALESCE(SUM(amount),0) AS total FROM payments " +
                            "WHERE status IN ('success','paid') AND is_test = 0 AND substr(timestamp,1,10) >= ?"
                        ).bind(sejak7).first()
                    ]);
                    const rp = (n) => 'Rp ' + Number(n).toLocaleString('id-ID');
                    const pesan = '<b>🌅 Ringkasan revenue SiapPsikotes — ' + tanggalWIB + ' 07:00 WIB</b>\n' +
                        'Kemarin (WIB): ' + (kemarin && kemarin.n ? kemarin.n + ' bayar · ' + rp(kemarin.total) : 'belum ada pembayaran') + '\n' +
                        'Hari ini s/d 07:00: ' + (hariIni && hariIni.n ? hariIni.n + ' bayar · ' + rp(hariIni.total) : 'belum ada pembayaran') + '\n' +
                        '7 hari terakhir: ' + ((tujuh && tujuh.n) || 0) + ' bayar · ' + rp(tujuh ? tujuh.total : 0);
                    const tg = await kirimTelegramAlert(env, pesan);
                    if (tg.ok && !tanpaGuard) {
                        try { await env.FUNNEL_KV.put(KUNCI, JSON.stringify({ waktu: new Date().toISOString(), message_id: tg.message_id || null })); } catch (e) {}
                    }
                    return { ok: !!tg.ok, tg: tg, tanggal: tanggalWIB, pesan: pesan, kemarin: kemarin, hari_ini: hariIni };
                } catch (e) {
                    return { ok: false, rincian: String(e.message || e).slice(0, 160) };
                }
            }

            // ===== Rekonsiliasi klaim "sudah bayar" vs pembayaran masuk =====
            // Satu fungsi dipakai endpoint /api/rekonsiliasi-ringkasan dan cron 08:00 WIB.
            // Klaim (kode_terbit.asal='klaim') cocok dengan payments NYATA (status success/paid,
            // is_test=0, rujukan sama DAN nominal sama). Klaim yang tidak ketemu -> butuh_pemilik.
            async function rekonsiliasiRingkasan(env, hari) {
            const jumlahHari = Math.min(90, Math.max(1, parseInt(hari, 10) || 7)) || 7;
            const sejak = new Date(Date.now() - (jumlahHari - 1) * 864e5).toISOString();
            // Kode terbit otomatis DULU: klaim yang cocok pembayaran nyata naik ke
            // 'klaim-cron' sebelum baris dibaca, jadi hitungan di bawah sudah akhir.
            await autoTerbitkanKlaimCocok(env);
            const [klaim, masuk, uji] = await Promise.all([
            env.DB.prepare(
                "SELECT rujukan, nominal, dibayar, kode_akhir, kontak FROM kode_terbit " +
                "WHERE asal = 'klaim' AND dibayar IS NOT NULL AND dibayar >= ? ORDER BY dibayar DESC LIMIT 200"
            ).bind(sejak).all(),
            env.DB.prepare(
                "SELECT rujukan, timestamp, amount, txid, utm_source FROM payments " +
                "WHERE status IN ('success','paid') AND is_test = 0 AND rujukan IS NOT NULL AND timestamp >= ? " +
                "ORDER BY timestamp DESC LIMIT 2000"
            ).bind(sejak).all(),
            // Peristiwa klaim per rujukan: is_test=1 = klaim QA/probe, dikecualikan dari uang.
            env.DB.prepare(
                "SELECT rincian, is_test FROM peristiwa WHERE jenis = 'beli:klaim_bayar' AND waktu >= ? LIMIT 1000"
            ).bind(sejak).all()
            ]);
            const ujiRujukan = {};
            for (const u of (uji.results || [])) {
            const rj = String(u.rincian || '').split('|')[0].toUpperCase();
            if (rj && Number(u.is_test) === 1) ujiRujukan[rj] = true;
            }
            const kini = Date.now();
            let jumlahCocok = 0, nominalCocok = 0, jumlahUji = 0;
            const perRujukan = {};
            for (const p of (masuk.results || [])) (perRujukan[String(p.rujukan)] = perRujukan[String(p.rujukan)] || []).push(p);
            const rows = (klaim.results || []).map(k => {
            const nominal = Math.round(Number(k.nominal) || 0);
            // Klaim uji (peristiwa beli:klaim_bayar is_test=1, QA/probe): tampil sebagai
            // status 'uji', dikecualikan dari SEMUA hitungan uang.
            if (ujiRujukan[String(k.rujukan).toUpperCase()]) {
            jumlahUji++;
            return {
                rujukan: k.rujukan, kode_akhir: k.kode_akhir, nominal: nominal,
                kontak: k.kontak || null,
                klaim_waktu: String(k.dibayar),
                status: 'uji',
                alasan: 'klaim_is_test',
                nominal_masuk: 0,
                payments: [],
                tunggu_jam: 0
            };
            }
            const sembapMasuk = perRujukan[String(k.rujukan)] || [];
            const tepat = sembapMasuk.filter(p => Math.round(Number(p.amount) || 0) === nominal);
            const klaimMs = new Date(String(k.dibayar)).getTime() || 0;
            if (tepat.length) {
                const ts = new Date(String(tepat[tepat.length - 1].timestamp)).getTime() || klaimMs;
                // Pembayaran bisa tercatat SEBELUM klaim (pembeli bayar dulu, klaim kemudian):
                // itu bukan waktu tunggu, jadi 0.
                const tunggu = ts > klaimMs ? (ts - klaimMs) / 3600e3 : 0;
                jumlahCocok++; nominalCocok += nominal;
                return {
                    rujukan: k.rujukan, kode_akhir: k.kode_akhir, nominal: nominal,
                    kontak: k.kontak || null,
                    klaim_waktu: String(k.dibayar),
                    status: 'tercocok',
                    nominal_masuk: nominal,
                    payments: tepat.map(p => ({ timestamp: p.timestamp, amount: Math.round(Number(p.amount) || 0), txid: p.txid, utm_source: p.utm_source })),
                    tunggu_jam: Math.round(tunggu * 10) / 10
                };
            }
            // butuh_pemilik: baik benar-benar belum ada transfer, atau nominal tidak sama
            // dengan pesanan (mis. pembeli salah nominal) — dua-duanya perlu mata pemilik.
            const tunggu = (kini - klaimMs) / 3600e3;
            return {
                rujukan: k.rujukan, kode_akhir: k.kode_akhir, nominal: nominal,
                kontak: k.kontak || null,
                klaim_waktu: String(k.dibayar),
                status: 'butuh_pemilik',
                alasan: sembapMasuk.length ? 'nominal_beda' : 'tanpa_pembayaran',
                nominal_masuk: sembapMasuk.reduce((a, p) => a + Math.round(Number(p.amount) || 0), 0),
                payments: sembapMasuk.map(p => ({ timestamp: p.timestamp, amount: Math.round(Number(p.amount) || 0), txid: p.txid, utm_source: p.utm_source })),
                tunggu_jam: Math.round(tunggu * 10) / 10
            };
            });
            const batas24 = kini - 24 * 3600e3;
            const r24 = rows.filter(r => new Date(r.klaim_waktu).getTime() >= batas24);
            return {
            ok: true,
            waktu: new Date().toISOString(),
            hari: jumlahHari,
            ringkasan: {
                klaim_total: rows.length,
                tercocok: jumlahCocok,
                uji: jumlahUji,
                butuh_pemilik: rows.filter(r => r.status === 'butuh_pemilik').length,
                nominal_klaim_tp: rows.filter(r => r.status === 'butuh_pemilik').reduce((a, r) => a + r.nominal, 0),
                nominal_tercocok: nominalCocok,
                klaim_24jam: r24.length,
                tercocok_24jam: r24.filter(r => r.status === 'tercocok').length,
                uji_24jam: r24.filter(r => r.status === 'uji').length,
                butuh_pemilik_24jam: r24.filter(r => r.status === 'butuh_pemilik').length,
                backlog_24jam: rows.filter(r => r.status === 'butuh_pemilik' && r.tunggu_jam > 24).length
            },
            klaim: rows
            };
            }

            // Cron pagi 08:00 WIB (ubah milik task rekonsiliasi): tidak lagi menunggu laporan
            // 23:55. Klaim "sudah bayar" yang >6 jam belum tercocok pembayaran masuk dikabarkan
            // sebagai daftar tindakan: link cek QR/transfer, kontak klaimer, dan backlog >24 jam
            // untuk tindak lanjut tim MARKETING (bukan admin). Sekali per hari WIB (KV guard).
            async function rekonsCronPagi(env) {
            try {
            const tanggalWIB = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
            const kunci = 'rekons:pagi:' + tanggalWIB;
            if (await env.FUNNEL_KV.get(kunci)) return { ok: true, lewati: 'sudah dikirim hari ini' };
            const data = await rekonsiliasiRingkasan(env, 7);
            const belum = (data.klaim || []).filter(r => r.status === 'butuh_pemilik');
            const belum6 = belum.filter(r => r.tunggu_jam > 6);
            const backlog = belum.filter(r => r.tunggu_jam > 24);
            let msg = '<b>🕘 Rekonsiliasi pagi — klaim "sudah bayar"</b>\n' +
                '24 jam terakhir: klaim ' + data.ringkasan.klaim_24jam +
                ' · tercocok ' + data.ringkasan.tercocok_24jam +
                ' · belum ' + data.ringkasan.butuh_pemilik_24jam +
                ' (' + jumlahRupiah(data.ringkasan.nominal_klaim_tp) + ' perlu dicek)\n';
            if (data.ringkasan.uji) msg += 'Klaim uji dikecualikan dari hitungan uang (event is_test=1): ' + data.ringkasan.uji + '\n';
            if (belum6.length) {
                msg += '\n<b>Belum nyambung >6 jam (' + belum6.length + '):</b>\n' + belum6.map(r =>
                    '• ' + r.rujukan + ' · Rp ' + Number(r.nominal).toLocaleString('id-ID') +
                    ' · klaim ' + String(r.klaim_waktu).slice(0, 16).replace('T', ' ') + ' UTC' +
                    ' (' + r.tunggu_jam + ' jam)' + (r.kontak ? '\n  kontak: ' + r.kontak : '\n  kontak: (kosong)') +
                    (r.alasan === 'nominal_beda' ? '\n  alasan: nominal masuk beda' : '')
                ).join('\n') + '\nCek QR/transfer: https://siappsikotes.my.id/beli/\n';
            } else {
                msg += '\nTidak ada klaim >6 jam yang belum nyambung. 👍\n';
            }
            if (backlog.length) {
                msg += '\n<b>⏳ Backlog >24 jam — ikut tindak lanjut tim marketing:</b>\n' + backlog.map(r =>
                    '• ' + r.rujukan + ' · Rp ' + Number(r.nominal).toLocaleString('id-ID') +
                    ' · ' + r.tunggu_jam + ' jam · kontak: ' + (r.kontak || '(kosong)')
                ).join('\n') + '\n';
            }
            msg += '\nTabel lengkap: https://siappsikotes-api.rasyidahmad180.workers.dev/api/rekonsiliasi-ringkasan' +
                (env.LAPORAN_TOKEN ? '\nCSV bukti run: https://siappsikotes-api.rasyidahmad180.workers.dev/api/rekonsiliasi-ringkasan?token=' + encodeURIComponent(env.LAPORAN_TOKEN) + '&format=csv' : '');
            const tg = await kirimTelegramAlert(env, msg);
            // Guard idempoten ditulis SETELAH upaya kirim: pengulangan hari yang sama tak digandakan.
            try { await env.FUNNEL_KV.put(kunci, JSON.stringify({ waktu: data.waktu, terkirin: !!tg.ok, jumlah: belum.length })); } catch (e) {}
            return { ok: true, terkirim: !!tg.ok, jumlah_belum: belum.length };
            } catch (e) {
            return { ok: false, pesan: String(e.message || e).slice(0, 160) };
            }
            }

            function jumlahRupiah(n) {
            return Number(n || 0).toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
            }

            // Ingatan harian SEKALI sehari: jalur A Tripay tetap 503 (fail-closed) sampai pemilik
            // memasang secret. JANGAN ikut membludak alarm monitoring bila satu-satunya penyebab
            // adalah konfigurasi belum dipasang — alert 'Tripay belum dikonfigurasi' muncul
            // maksimal 1x/hari (KV), sisanya jalan QRIS statis + klaim seperti biasa.
            async function ingatkanTripayBelumPasang(env) {
            const sudahPasang = env.TRIPAY_API_KEY && env.TRIPAY_PRIVATE_KEY && env.TRIPAY_KODE_MERCHANT;
            if (sudahPasang) return { ok: true, pesan: 'konfigurasi tersedia' };
            const tanggalWIB = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
            const kunci = 'alert:tripay-setup:' + tanggalWIB;
            if (await env.FUNNEL_KV.get(kunci)) return { ok: true, lewati: 'sudah diingatkan hari ini' };
            const tg = await kirimTelegramAlert(env, '<b>⏳ Ingatan sekali sehari: Tripay belum dikonfigurasi</b>\n' +
            'Jalur A (QRIS otomatis) tetap 503 fail-closed sampai pemilik memasang\n' +
            'secret TRIPAY_API_KEY + TRIPAY_PRIVATE_KEY + TRIPAY_KODE_MERCHANT.\n' +
            'Sementara itu pembeli memakai QRIS statis + klaim "sudah bayar" — aman.');
            try { await env.FUNNEL_KV.put(kunci, tanggalWIB); } catch (e) {}
            return { ok: true, terkirim: !!tg.ok };
            }

            // ===== Dashboard funnel harian 1-URL =====
          // Hitung funnel /beli/ per hari (UTC): kunjungan -> klik CTA bayar -> QRIS tampil
          // -> pembayaran terkonfirmasi (webhook), plus cart-abandon dan revenue.
          // Dipakai oleh GET /api/funnel dan snapshot cron (simpanSnapshotFunnel).
          async function funnelHarianJson(env) {
              const jumlahHari = 7;
              const hariIni = new Date().toISOString().slice(0, 10);
              const daftarHari = [];
              for (let i = 0; i < jumlahHari; i++) {
                  daftarHari.push(new Date(Date.now() - (jumlahHari - 1 - i) * 864e5).toISOString().slice(0, 10));
              }
              const awal = daftarHari[0];
              const [pe, pay] = await Promise.all([
                  env.DB.prepare(
                      "SELECT substr(waktu,1,10) AS hari, " +
                      "COUNT(DISTINCT CASE WHEN jenis = 'beli:kunjungan_beli' THEN rincian END) AS kunjungan, " +
                      "COUNT(DISTINCT CASE WHEN jenis = 'beli:klik_cta_bayar' THEN rincian END) AS klik, " +
                      "COUNT(DISTINCT CASE WHEN jenis = 'beli:qris_tampil' THEN rincian END) AS qris " +
                      "FROM peristiwa WHERE jenis IN ('beli:kunjungan_beli','beli:klik_cta_bayar','beli:qris_tampil') " +
                      "AND is_test = 0 " +
                      "AND substr(waktu,1,10) >= ? GROUP BY substr(waktu,1,10)"
                  ).bind(awal).all(),
                  env.DB.prepare(
                      "SELECT substr(timestamp,1,10) AS hari, COUNT(*) AS bayar, COALESCE(SUM(amount),0) AS revenue " +
                      "FROM payments WHERE status IN ('success','paid') AND is_test = 0 AND substr(timestamp,1,10) >= ? GROUP BY substr(timestamp,1,10)"
                  ).bind(awal).all()
              ]);
              const mapHari = {};
              for (const r of (pe.results || [])) {
                  mapHari[r.hari] = { kunjungan: r.kunjungan || 0, klik: r.klik || 0, qris: r.qris || 0, bayar: 0, revenue: 0 };
              }
              for (const r of (pay.results || [])) {
                  if (!mapHari[r.hari]) mapHari[r.hari] = { kunjungan: 0, klik: 0, qris: 0, bayar: 0, revenue: 0 };
                  mapHari[r.hari].bayar = r.bayar || 0;
                  mapHari[r.hari].revenue = r.revenue || 0;
              }
              const bentuk = (h) => {
                  const d = mapHari[h] || { kunjungan: 0, klik: 0, qris: 0, bayar: 0, revenue: 0 };
                  return {
                      hari: h,
                      kunjungan: d.kunjungan,
                      klik_bayar: d.klik,
                      qris_dibuat: d.qris,
                      bayar_konfirmasi: d.bayar,
                      cart_abandon: Math.max(0, d.klik - d.bayar),
                      revenue_rp: d.revenue,
                      konversi_pct: d.kunjungan ? Math.round((d.bayar / d.kunjungan) * 10000) / 100 : 0
                  };
              };
              const harian = daftarHari.map(bentuk);
              const total = harian.reduce((a, b) => ({
                  kunjungan: a.kunjungan + b.kunjungan,
                  klik_bayar: a.klik_bayar + b.klik_bayar,
                  qris_dibuat: a.qris_dibuat + b.qris_dibuat,
                  bayar_konfirmasi: a.bayar_konfirmasi + b.bayar_konfirmasi,
                  revenue_rp: a.revenue_rp + b.revenue_rp
              }), { kunjungan: 0, klik_bayar: 0, qris_dibuat: 0, bayar_konfirmasi: 0, revenue_rp: 0 });
              total.cart_abandon = Math.max(0, total.klik_bayar - total.bayar_konfirmasi);
              total.konversi_pct = total.kunjungan ? Math.round((total.bayar_konfirmasi / total.kunjungan) * 10000) / 100 : 0;
              return {
                  aplikasi: 'SiapPsikotes',
                  judul: 'Funnel harian /beli/',
                  waktu_snapshot: new Date().toISOString(),
                  zona_hari: 'UTC',
                  cron_snapshot: '0 */6 * * * (tiap 6 jam)',
                  definisi: {
                      kunjungan: 'pengunjung unik /beli/ (rujukan SP-xxx, event kunjungan_beli)',
                      klik_bayar: 'klik unik tombol CTA bayar',
                      qris_dibuat: 'QRIS tampil unik',
                      bayar_konfirmasi: 'webhook pembayaran status success/paid (Tripay/QRIS)',
                      cart_abandon: 'klik_bayar tanpa bayar_konfirmasi (min. 0)',
                      konversi_pct: 'bayar_konfirmasi / kunjungan * 100'
                  },
                  hari_ini: bentuk(hariIni),
                  total_7_hari: total,
                  '7_hari': harian
              };
          }

          // Simpan snapshot funnel ke KV. Dipanggil cron tiap 6 jam; GET /api/funnel
          // juga memanggil jalur penulisan yang sama saat snapshot belum ada (pulih sendiri).
          async function simpanSnapshotFunnel(env) {
              try {
                  const data = await funnelHarianJson(env);
                  data.sumber = 'snapshot-kv';
                  await env.FUNNEL_KV.put('funnel:terkini', JSON.stringify(data));
                  return { ok: true, waktu: data.waktu_snapshot, hari_ini: data.hari_ini };
              } catch (e) {
                  return { ok: false, pesan: String(e.message || e).slice(0, 160) };
              }
          }

          // ===== Dashboard A/B /beli/: konversi per varian A vs B =====
          // Sumber data = CSV funnel yang sudah ada, dibaca langsung dari D1 (gratis):
          //   - peristiwa  : beacon /api/pantau, rincian 'SP-123|var:a' (tag varian server-side)
          //   - payments   : webhook QRIS/Tripay, kolom rujukan (is_test=0 = beneran uang masuk)
          // Atribusi pembayaran -> varian lewat peta rujukan->varian dari beacon: varian PERTAMA
          // yang tercatat untuk rujukan itu yang menang (kunjungan mendahului klik & bayar).
          async function abBeliJson(env, days) {
              const sejak = new Date(Date.now() - (days - 1) * 864e5).toISOString().slice(0, 10);
              const hingga = new Date().toISOString().slice(0, 10);
              const JENIS_AB = "('beli:kunjungan_beli','beli:klik_cta_bayar','beli:qris_tampil')";
              const [pe, pay, pet] = await Promise.all([
                  // Funnel per varian: tag menempel di ujung rincian, varian '-' = beacon tanpa tag.
                  env.DB.prepare(
                      "SELECT CASE WHEN rincian LIKE '%|var:a' THEN 'a' WHEN rincian LIKE '%|var:b' THEN 'b' ELSE '-' END AS varian, " +
                      "COUNT(DISTINCT CASE WHEN jenis = 'beli:kunjungan_beli' THEN rincian END) AS kunjungan, " +
                      "COUNT(DISTINCT CASE WHEN jenis = 'beli:klik_cta_bayar' THEN rincian END) AS klik, " +
                      "COUNT(DISTINCT CASE WHEN jenis = 'beli:qris_tampil' THEN rincian END) AS qris " +
                      "FROM peristiwa WHERE jenis IN " + JENIS_AB + " AND COALESCE(is_test,0) = 0 AND substr(waktu,1,10) >= ? GROUP BY varian"
                  ).bind(sejak).all(),
                  // Pembayaran sukses per rujukan (definisi sama dengan CSV funnel harian).
                  env.DB.prepare(
                      "SELECT rujukan, COUNT(*) AS bayar, COALESCE(SUM(amount),0) AS revenue FROM payments " +
                      "WHERE status IN ('success','paid') AND is_test = 0 AND substr(timestamp,1,10) >= ? GROUP BY rujukan"
                  ).bind(sejak).all(),
                  // Peta rujukan -> varian dari beacon (baris 'SP-123|var:a' saja).
                  env.DB.prepare(
                      "SELECT rincian, waktu FROM peristiwa WHERE jenis IN " + JENIS_AB + " " +
                      "AND COALESCE(is_test,0) = 0 AND rincian LIKE 'SP-%|var:%' AND substr(waktu,1,10) >= ? ORDER BY waktu ASC LIMIT 20000"
                  ).bind(sejak).all()
              ]);
              const varianRujukan = {};
              for (const r of (pet.results || [])) {
                  const m = /^(SP-\d{3})\|var:([ab])$/.exec(r.rincian || '');
                  if (m && !varianRujukan[m[1]]) varianRujukan[m[1]] = m[2];
              }
              const kotakKosong = () => ({ kunjungan: 0, klik_bayar: 0, qris_dibuat: 0, bayar_sukses: 0, revenue_rp: 0 });
              const perVarian = { a: kotakKosong(), b: kotakKosong(), '-': kotakKosong() };
              for (const r of (pe.results || [])) {
                  const kotak = perVarian[r.varian];
                  if (!kotak) continue;
                  kotak.kunjungan = r.kunjungan || 0;
                  kotak.klik_bayar = r.klik || 0;
                  kotak.qris_dibuat = r.qris || 0;
              }
              let tanpaVarian = { bayar: 0, revenue: 0 };
              for (const r of (pay.results || [])) {
                  const v = r.rujukan ? varianRujukan[String(r.rujukan).toUpperCase()] : null;
                  const kotak = v ? perVarian[v] : null;
                  if (kotak) { kotak.bayar_sukses += r.bayar || 0; kotak.revenue_rp += r.revenue || 0; }
                  else { tanpaVarian.bayar += r.bayar || 0; tanpaVarian.revenue += r.revenue || 0; }
              }
              for (const k of ['a', 'b', '-']) {
                  const d = perVarian[k];
                  d.klik_pct = d.kunjungan ? Math.round((d.klik_bayar / d.kunjungan) * 10000) / 100 : 0;
                  d.bayar_pct = d.kunjungan ? Math.round((d.bayar_sukses / d.kunjungan) * 10000) / 100 : 0;
              }
              const total = kotakKosong();
              for (const k of ['a', 'b', '-']) {
                  total.kunjungan += perVarian[k].kunjungan;
                  total.klik_bayar += perVarian[k].klik_bayar;
                  total.qris_dibuat += perVarian[k].qris_dibuat;
                  total.bayar_sukses += perVarian[k].bayar_sukses;
                  total.revenue_rp += perVarian[k].revenue_rp;
              }
              // Total memuat SEMUA pembayaran sukses (atribusi + tanpa atribusi) supaya
              // angkanya cocok dengan /api/funnel dan tidak ada uang yang hilang dari funnel.
              total.bayar_sukses += tanpaVarian.bayar;
              total.revenue_rp += tanpaVarian.revenue;
              total.klik_pct = total.kunjungan ? Math.round((total.klik_bayar / total.kunjungan) * 10000) / 100 : 0;
              total.bayar_pct = total.kunjungan ? Math.round((total.bayar_sukses / total.kunjungan) * 10000) / 100 : 0;
              return {
                  aplikasi: 'SiapPsikotes',
                  judul: 'A/B /beli/ — konversi per varian',
                  waktu: new Date().toISOString(),
                  zona_hari: 'UTC',
                  jendela: { hari: days, sejak, hingga },
                  definisi: {
                      kunjungan: 'pengunjung unik /beli/ per varian (event kunjungan_beli, tag varian di rincian)',
                      klik_bayar: 'klik unik tombol CTA bayar per varian',
                      bayar_sukses: 'webhook QRIS/Tripay success|paid (is_test=0), diatribusikan lewat rujukan SP-xxx',
                      bayar_pct: 'bayar_sukses / kunjungan * 100',
                      tanpa_tag_varian: 'beacon tanpa tag varian (traffic pra-A/B atau cookie belum terpasang)',
                      bayar_tanpa_varian: 'pembayaran sukses yang rujukannya tidak pernah terlihat di beacon'
                  },
                  varian: { a: perVarian.a, b: perVarian.b },
                  tanpa_tag_varian: perVarian['-'],
                  bayar_tanpa_varian: tanpaVarian.bayar,
                  revenue_tanpa_varian: tanpaVarian.revenue,
                  total: total,
                  keputusan: keputusanPemenang(perVarian.a, perVarian.b)
              };
          }

          // Dasar keputusan copy pemenang: z-test dua proporsi (dua arah, alpha 0.05).
          // Pemenang hanya dinyatakan bila kedua varian sudah cukup sampel — sebelum itu
          // endpoint tetap jujur menyatakan "belum bisa diputuskan".
          const AB_MIN_KUNJUNGAN = 150;
          function keputusanPemenang(a, b) {
              if (a.kunjungan < AB_MIN_KUNJUNGAN || b.kunjungan < AB_MIN_KUNJUNGAN) {
                  return { pemenang: null, alasan: 'sampel belum cukup — butuh >= ' + AB_MIN_KUNJUNGAN +
                      ' kunjungan per varian (A: ' + a.kunjungan + ', B: ' + b.kunjungan + ')' };
              }
              const n1 = a.kunjungan, n2 = b.kunjungan, x1 = a.bayar_sukses, x2 = b.bayar_sukses;
              const p = (x1 + x2) / (n1 + n2);
              const se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2));
              if (se === 0) return { pemenang: null, alasan: 'belum ada pembayaran di kedua varian' };
              const z = (x1 / n1 - x2 / n2) / se;
              if (Math.abs(z) < 1.96) {
                  return { pemenang: null, alasan: 'selisih konversi belum signifikan (A ' + a.bayar_pct +
                      '% vs B ' + b.bayar_pct + '%, z=' + z.toFixed(2) + ', butuh |z| >= 1.96)' };
              }
              const pemenang = z > 0 ? 'a' : 'b';
              return { pemenang: pemenang,
                  alasan: 'konversi A ' + a.bayar_pct + '% vs B ' + b.bayar_pct + '% (z=' + z.toFixed(2) +
                  ', signifikan alpha 0.05) — pakai copy varian ' + pemenang.toUpperCase() };
          }

          // Cek Tripay webhook (placeholder - static QRIS manual, tidak pakai Tripay)
          async function cekTripayWebhook() {
              if (!TRIPAY_WEBHOOK_URL) return { ok: true, status: 0, rincian: 'Tripay tidak dikonfigurasi (static QRIS manual)' };
              try {
                  const controller = new AbortController();
                  const timeout = setTimeout(() => controller.abort(), 10000);
                  const resp = await fetch(TRIPAY_WEBHOOK_URL + '/health', {
                      method: 'GET',
                      signal: controller.signal
                  });
                  clearTimeout(timeout);
                  return { ok: resp.ok, status: resp.status, rincian: resp.ok ? 'OK' : 'HTTP ' + resp.status };
              } catch (e) {
                  return { ok: false, status: 0, rincian: 'Tripay error: ' + String(e.message || e).slice(0, 100) };
              }
          }

          async function cekBeliPage(env) {
              const mulai = Date.now();
              let status = 0;
              let okQris = 0;
              let okTurnstile = 0;
              let okCta = 0;
              let rincian = '';

              try {
                  const controller = new AbortController();
                  const timeout = setTimeout(() => controller.abort(), 15000);
                  const resp = await fetch(MONITOR_ENDPOINT, {
                      method: 'GET',
                      headers: { 'User-Agent': 'SiapPsikotes-Monitor/1.0' },
                      signal: controller.signal,
                      cf: { cacheTtl: 0, cacheEverything: false }
                  });
                  clearTimeout(timeout);
                  status = resp.status;
                  const html = await resp.text();
                  const latency = Date.now() - mulai;

                  // Cek marker QRIS: gambar QRIS, teks QRIS, container #qris
                  const adaQris = /qris-bayar\.png/i.test(html) || /id=["']qris["']/i.test(html) || /\bQRIS\b/i.test(html);
                  // Cek TIDAK ada Turnstile challenge
                  const adaTurnstile = /cf-chl|turnstile|challenge-platform|__cf_chl/i.test(html);
                  // Cek tombol CTA bayar
                  const adaCta = /id=["']ctaBayar["']/i.test(html);

                  okQris = adaQris ? 1 : 0;
                  okTurnstile = adaTurnstile ? 0 : 1; // 1 = baik (tidak ada Turnstile)
                  okCta = adaCta ? 1 : 0;

                  const parts = [];
                  if (!adaQris) parts.push('QRIS hilang');
                  if (adaTurnstile) parts.push('Turnstile terdeteksi');
                  if (!adaCta) parts.push('CTA hilang');
                  rincian = parts.length ? parts.join(', ') : 'OK';

                  // Simpan ke D1
                  await env.DB.prepare(
                      'INSERT INTO monitoring_checks (waktu, endpoint, status, ok_qris, ok_turnstile, ok_cta, latency_ms, rincian, alert_terkirim) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)'
                  ).bind(new Date().toISOString(), MONITOR_ENDPOINT, status, okQris, okTurnstile, okCta, latency, rincian).run();

                  // Jika gagal, kirim alert Telegram
                  const sehat = status === 200 && okQris && okTurnstile && okCta;
                  if (!sehat) {
                      const alertMsg = `⚠️ <b>Monitoring /beli/ GAGAL</b>\n` +
                          `Waktu: ${new Date().toISOString()}\n` +
                          `Status HTTP: ${status}\n` +
                          `QRIS: ${okQris ? '✅' : '❌'}\n` +
                          `Turnstile: ${okTurnstile ? '✅ (tidak ada)' : '❌ (terdeteksi)'}\n` +
                          `CTA: ${okCta ? '✅' : '❌'}\n` +
                          `Latency: ${latency}ms\n` +
                          `Rincian: ${rincian}`;
                      const alertResult = await kirimTelegramAlert(env, alertMsg);
                      // Tandai alert terkirim
                      await env.DB.prepare(
                          'UPDATE monitoring_checks SET alert_terkirim = 1 WHERE waktu = (SELECT MAX(waktu) FROM monitoring_checks WHERE endpoint = ?)'
                      ).bind(MONITOR_ENDPOINT).run();
                      return { ok: false, status, okQris, okTurnstile, okCta, latency, rincian, alert: alertResult };
                  }
                  return { ok: true, status, okQris, okTurnstile, okCta, latency, rincian };
              } catch (e) {
                  const latency = Date.now() - mulai;
                  const errMsg = String(e.message || e).slice(0, 160);
                  await env.DB.prepare(
                      'INSERT INTO monitoring_checks (waktu, endpoint, status, ok_qris, ok_turnstile, ok_cta, latency_ms, rincian, alert_terkirim) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)'
                  ).bind(new Date().toISOString(), MONITOR_ENDPOINT, 0, 0, 0, 0, latency, 'Fetch error: ' + errMsg).run();

                  const alertMsg = `🚨 <b>Monitoring /beli/ ERROR</b>\n` +
                      `Waktu: ${new Date().toISOString()}\n` +
                      `Error: ${errMsg}`;
                  const alertResult = await kirimTelegramAlert(env, alertMsg);
                  await env.DB.prepare(
                      'UPDATE monitoring_checks SET alert_terkirim = 1 WHERE waktu = (SELECT MAX(waktu) FROM monitoring_checks WHERE endpoint = ?)'
                  ).bind(MONITOR_ENDPOINT).run();
                  return { ok: false, status: 0, okQris: 0, okTurnstile: 0, okCta: 0, latency, rincian: errMsg, alert: alertResult };
              }
          }

          // Monitoring komprehensif: /beli/ + funnel CSV + Tripay webhook
          async function cekMonitoringLengkap(env) {
              const [beli, funnel, tripay] = await Promise.all([
                  cekBeliPage(env),
                  cekFunnelCSV(env),
                  cekTripayWebhook()
              ]);

              const semuaSehat = beli.ok && funnel.ok && tripay.ok;
              const rincianGabungan = [
                  'beli: ' + (beli.ok ? 'OK' : 'GAGAL - ' + beli.rincian),
                  'funnel: ' + (funnel.ok ? 'OK' + (funnel.mode && funnel.mode !== 'trafik' ? ' [' + funnel.mode + ']' : '')
                                          : 'GAGAL - ' + funnel.rincian),
                  'tripay: ' + (tripay.ok ? 'OK' : 'GAGAL - ' + tripay.rincian)
              ].join('; ');

              // Simpan ringkasan ke D1 (bisa extend tabel monitoring_checks nanti)
              // Anti-banjir alert: satu alert per SEBAB per 60 menit. Cron jalan tiap 10 menit;
              // tanpa rem ini satu gangguan yang bertahan semalaman jadi ~144 pesan Telegram.
              // Saat kembali normal setelah sempat gagal, dikirim tepat satu pesan pemulihan.
              const sidik = (function () {
                  let h = 2166136261;
                  const s = rincianGabungan;
                  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
                  return h.toString(36);
              })();
              let alertDikirim = false, alertDilewati = false;
              try {
                  const kunciAlert = 'alert:monitor:' + sidik;
                  const terakhir = parseInt(await env.FUNNEL_KV.get(kunciAlert), 10) || 0;
                  const menitLalu = (Date.now() - terakhir) / 60000;
                  if (!semuaSehat && menitLalu >= 60) {
                      const alertMsg = `🚨 <b>Monitoring Komprehensif GAGAL</b>\n` +
                          `Waktu: ${new Date().toISOString()}\n` +
                          `Rincian: ${rincianGabungan}`;
                      const kirim = await kirimTelegramAlert(env, alertMsg);
                      alertDikirim = !!kirim.ok;
                      await env.FUNNEL_KV.put(kunciAlert, String(Date.now()), { expirationTtl: 6 * 3600 });
                      await env.FUNNEL_KV.put('alert:monitor:status', 'gagal', { expirationTtl: 7 * 86400 });
                  } else if (!semuaSehat) {
                      alertDilewati = true;   // sebab sama sudah dilaporkan < 60 menit lalu
                  }
                  if (semuaSehat && (await env.FUNNEL_KV.get('alert:monitor:status')) === 'gagal') {
                      await kirimTelegramAlert(env, `✅ <b>Monitoring Komprehensif PULIH</b>\n` +
                          `Waktu: ${new Date().toISOString()}\nRincian: ${rincianGabungan}`);
                      await env.FUNNEL_KV.put('alert:monitor:status', 'sehat', { expirationTtl: 7 * 86400 });
                  }
              } catch (e) {}
              return { ok: semuaSehat, beli, funnel, tripay, rincian: rincianGabungan,
                       mode_funnel: funnel.mode || null, alert: { dikirim: alertDikirim, dilewati: alertDilewati } };
          }

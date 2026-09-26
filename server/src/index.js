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
  'https://arapcihuy.github.io', 'http://localhost:8000', 'http://127.0.0.1:8000'];
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

export default {
  async fetch(request, env) {
    const asal = request.headers.get('Origin') || '';
    const url = new URL(request.url);
    const jalan = url.pathname.replace(/\/+$/, '') || '/';

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(asal) });
    if (asal && SITUS.indexOf(asal) === -1) return jawab({ pesan: 'asal tidak diizinkan' }, 403, asal);

    try {
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

      if (jalan === '/' || jalan === '/sehat') {
        return jawab({ aplikasi: 'SiapPsikotes API', keadaan: 'hidup', waktu: new Date().toISOString() }, 200, asal);
      }

      return jawab({ pesan: 'alamat tidak dikenal' }, 404, asal);
    } catch (e) {
      return jawab({ pesan: 'permintaan tidak bisa diproses', rincian: String(e.message || e).slice(0, 160) }, 400, asal);
    }
  }
};

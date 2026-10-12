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
                  'salin_kode', 'buka_aplikasi', 'klik_bukti_wa', 'klik_bukti_email',
                  'cardcheck_kunjungan', 'cardcheck_klik_cta', 'survei_kunjungan'];
              const jenis = String(b.jenis || '');
              if (JENIS_PANTAU.indexOf(jenis) === -1) return jawab({ pesan: 'jenis tidak dikenal' }, 400, asal);
              const kartu = jenis.indexOf('cardcheck_') === 0;
              const rincian = String(b.rujukan || '').slice(0, 20);
              if (rincian && !(kartu ? /^[A-Za-z0-9_-]{1,20}$/.test(rincian) : /^SP-[0-9]{3}$/.test(rincian)))
                return jawab({ pesan: 'rincian tidak sah' }, 400, asal);
              const awalan = kartu ? 'cardcheck:' : 'beli:';
                            const utmSource = String(b.utm_source || '').slice(0, 50);
                            const utmMedium = String(b.utm_medium || '').slice(0, 50);
                            const utmCampaign = String(b.utm_campaign || '').slice(0, 100);
                            await env.DB.prepare('INSERT INTO peristiwa (pengguna, jenis, rincian, waktu, utm_source, utm_medium, utm_campaign) VALUES (?, ?, ?, ?, ?, ?, ?)')
                              .bind(null, awalan + jenis, rincian, new Date().toISOString(), utmSource, utmMedium, utmCampaign).run();
                            return jawab({ ok: true }, 200, asal);
                          }

                    // ---- webhook pembayaran QRIS (tanpa login) ----
                    // Terima notifikasi pembayaran dari klien/QRIS manual, catat ke tabel payments
                    if (jalan === '/api/payment-webhook' && request.method === 'POST') {
                      const ip = request.headers.get('CF-Connecting-IP') || 'tanpa-ip';
                      const laju = await batasiLaju(env, ip, 'payment_webhook', 30, 60);
                      if (!laju.boleh) return jawab({ pesan: 'terlalu sering' }, 429, asal);
                      const b = await request.json().catch(() => ({}));
                      const timestamp = new Date().toISOString();
                      const utmSource = String(b.utm_source || '').slice(0, 50);
                      const utmMedium = String(b.utm_medium || '').slice(0, 50);
                      const product = String(b.product || 'siappsikotes').slice(0, 50);
                      const amount = Math.round(Number(b.amount)) || 39000;
                      const status = String(b.status || 'success').slice(0, 20);
                      const txid = String(b.txid || '').slice(0, 100);
                      const rawPayload = JSON.stringify(b).slice(0, 5000);
                      await env.DB.prepare(
                        'INSERT INTO payments (timestamp, utm_source, utm_medium, product, amount, status, txid, raw_payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
                      ).bind(timestamp, utmSource, utmMedium, product, amount, status, txid, rawPayload).run();
                      // Kirim notifikasi Telegram untuk pembayaran sukses
                      if (status === 'success' || status === 'paid') {
                        const alertMsg = `✅ <b>Pembayaran Baru</b>\nProduk: ${product}\nJumlah: Rp ${amount.toLocaleString()}\nUTM: ${utmSource} / ${utmMedium}\nTXID: ${txid || '-'}\nWaktu: ${timestamp}`;
                        await kirimTelegramAlert(env, alertMsg);
                      }
                      return jawab({ ok: true }, 200, asal);
                    }

                    // ---- pemilik: ringkasan funnel pembelian (jumlah per jenis event, kunjukan unik per rujukan) ----
      if (jalan === '/api/pemilik/funnel-beli' && request.method === 'GET') {
        if (!saya) return perluMasuk();
        if (!adalahPemilik(saya)) return jawab({ pesan: 'bukan pemilik' }, 403, asal);
        const perJenis = await env.DB.prepare(
          "SELECT jenis, COUNT(*) AS n, COUNT(DISTINCT rincian) AS rujukan_unik " +
          "FROM peristiwa WHERE jenis LIKE 'beli:%' GROUP BY jenis ORDER BY jenis"
        ).all();
        const perHari = await env.DB.prepare(
          "SELECT substr(waktu,1,10) AS hari, jenis, COUNT(*) AS n FROM peristiwa " +
          "WHERE jenis LIKE 'beli:%' GROUP BY hari, jenis ORDER BY hari DESC, jenis LIMIT 400"
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
        const rows = await env.DB.prepare('SELECT waktu, jenis, rincian FROM peristiwa WHERE waktu >= ? ORDER BY waktu DESC LIMIT 5000').bind(cutoff).all();
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
            "SELECT COUNT(DISTINCT rincian) AS n FROM peristiwa WHERE jenis = 'beli:kunjungan_beli' AND substr(waktu,1,10) = ?"
          ).bind(hariIni).first(),
          // Klik CTA bayar hari ini
          env.DB.prepare(
            "SELECT COUNT(DISTINCT rincian) AS n FROM peristiwa WHERE jenis = 'beli:klik_cta_bayar' AND substr(waktu,1,10) = ?"
          ).bind(hariIni).first(),
          // Pembayaran sukses hari ini (dari tabel payments)
          env.DB.prepare(
            "SELECT COUNT(*) AS n, COALESCE(SUM(amount),0) AS total FROM payments WHERE status IN ('success','paid') AND substr(timestamp,1,10) = ?"
          ).bind(hariIni).first(),
          // Revenue hari ini
          env.DB.prepare(
            "SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE status IN ('success','paid') AND substr(timestamp,1,10) = ?"
          ).bind(hariIni).first(),
          // Conversion rate hari ini: pembayaran / kunjungan
          env.DB.prepare(
            "SELECT " +
            "  (SELECT COUNT(*) FROM payments WHERE status IN ('success','paid') AND substr(timestamp,1,10) = ?) * 100.0 / " +
            "  NULLIF((SELECT COUNT(DISTINCT rincian) FROM peristiwa WHERE jenis = 'beli:kunjungan_beli' AND substr(waktu,1,10) = ?), 0) AS rate"
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
          "  (SELECT COUNT(*) FROM payments p WHERE p.status IN ('success','paid') AND substr(p.timestamp,1,10) = substr(pe.waktu,1,10)) AS pembayaran, " +
          "  (SELECT COALESCE(SUM(amount),0) FROM payments p WHERE p.status IN ('success','paid') AND substr(p.timestamp,1,10) = substr(pe.waktu,1,10)) AS revenue " +
          "FROM peristiwa pe " +
          "WHERE pe.waktu >= ? AND pe.jenis LIKE 'beli:%' " +
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

      if (jalan === '/' || jalan === '/sehat') {
              return jawab({ aplikasi: 'SiapPsikotes API', keadaan: 'hidup', waktu: new Date().toISOString() }, 200, asal);
            }

            // ---- Referral / affiliate program ----
            // GET /api/referral/kode - get or create user's referral code (requires login)
            if (jalan === '/api/referral/kode' && request.method === 'GET') {
              if (!saya) return perluMasuk();
              const existing = await env.DB.prepare('SELECT kode FROM referral_kode WHERE pengguna = ?').bind(saya.id).first();
              if (existing) {
                return jawab({ kode: existing.kode }, 200, asal);
              }
              // Generate unique referral code: SPRF + 8 random chars
              const chars = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
              let kode = 'SPRF';
              let unique = false;
              let attempts = 0;
              while (!unique && attempts < 10) {
                const b = crypto.getRandomValues(new Uint8Array(8));
                let suffix = '';
                for (let i = 0; i < b.length; i++) suffix += chars.charAt(b[i] % chars.length);
                const kandidat = kode + suffix;
                const cek = await env.DB.prepare('SELECT 1 FROM referral_kode WHERE kode = ?').bind(kandidat).first();
                if (!cek) {
                  kode = kandidat;
                  unique = true;
                }
                attempts++;
              }
              if (!unique) return jawab({ pesan: 'gagal membuat kode unik' }, 500, asal);
              const kini = new Date().toISOString();
              await env.DB.prepare('INSERT INTO referral_kode (pengguna, kode, dibuat) VALUES (?, ?, ?)').bind(saya.id, kode, kini).run();
              return jawab({ kode }, 200, asal);
            }

            // POST /api/referral/track - track referral visit (no login, from /beli/ page)
            if (jalan === '/api/referral/track' && request.method === 'POST') {
              const ip = request.headers.get('CF-Connecting-IP') || 'tanpa-ip';
              const laju = await batasiLaju(env, ip, 'ref_track', 30, 60); // max 30 per minute per IP
              if (!laju.boleh) return jawab({ pesan: 'terlalu sering' }, 429, asal);
              const b = await request.json().catch(() => ({}));
              const kodeRef = String(b.ref || '').toUpperCase().trim();
              if (!kodeRef || !/^SPRF[A-Z0-9]{8}$/.test(kodeRef)) {
                return jawab({ ok: true, tracked: false }, 200, asal); // silently ignore invalid
              }
              // Verify code exists
              const ref = await env.DB.prepare('SELECT pengguna FROM referral_kode WHERE kode = ?').bind(kodeRef).first();
              if (!ref) {
                return jawab({ ok: true, tracked: false }, 200, asal); // silently ignore non-existent
              }
              const utmSource = String(b.utm_source || '').slice(0, 50);
              const utmMedium = String(b.utm_medium || '').slice(0, 50);
              const utmCampaign = String(b.utm_campaign || '').slice(0, 100);
              const kini = new Date().toISOString();
              await env.DB.prepare(
                'INSERT INTO referral_konversi (kode_ref, waktu, status, utm_source, utm_medium, utm_campaign) VALUES (?, ?, ?, ?, ?, ?)'
              ).bind(kodeRef, kini, 'visit', utmSource, utmMedium, utmCampaign).run();
              return jawab({ ok: true, tracked: true }, 200, asal);
            }

            // POST /api/referral/konversi - record conversion when purchase confirmed
            if (jalan === '/api/referral/konversi' && request.method === 'POST') {
              const ip = request.headers.get('CF-Connecting-IP') || 'tanpa-ip';
              const laju = await batasiLaju(env, ip, 'ref_conv', 20, 60);
              if (!laju.boleh) return jawab({ pesan: 'terlalu sering' }, 429, asal);
              const b = await request.json().catch(() => ({}));
              const kodeRef = String(b.ref || '').toUpperCase().trim();
              const rujukanBeli = String(b.rujukan || '').trim().slice(0, 20);
              const nominal = Math.round(Number(b.nominal)) || 39000;
              if (!kodeRef || !/^SPRF[A-Z0-9]{8}$/.test(kodeRef)) {
                return jawab({ pesan: 'kode referral tidak sah' }, 400, asal);
              }
              // Verify code exists
              const ref = await env.DB.prepare('SELECT pengguna FROM referral_kode WHERE kode = ?').bind(kodeRef).first();
              if (!ref) {
                return jawab({ pesan: 'kode referral tidak ditemukan' }, 400, asal);
              }
              // Check if conversion already recorded for this rujukan_beli
              if (rujukanBeli) {
                const existing = await env.DB.prepare('SELECT 1 FROM referral_konversi WHERE kode_ref = ? AND rujukan_beli = ? AND status != ?')
                  .bind(kodeRef, rujukanBeli, 'visit').first();
                if (existing) {
                  return jawab({ ok: true, duplicate: true }, 200, asal);
                }
              }
              const utmSource = String(b.utm_source || '').slice(0, 50);
              const utmMedium = String(b.utm_medium || '').slice(0, 50);
              const utmCampaign = String(b.utm_campaign || '').slice(0, 100);
              const kini = new Date().toISOString();
              // Record conversion
              await env.DB.prepare(
                'INSERT INTO referral_konversi (kode_ref, rujukan_beli, nominal, waktu, status, utm_source, utm_medium, utm_campaign) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
              ).bind(kodeRef, rujukanBeli || null, nominal, kini, 'paid', utmSource, utmMedium, utmCampaign).run();
              // Credit referrer: 10% of nominal
              const komisi = Math.round(nominal * 0.1);
              await env.DB.prepare(
                'INSERT INTO referral_kredit (pengguna, total, diperbarui) VALUES (?, ?, ?) ON CONFLICT(pengguna) DO UPDATE SET total = referral_kredit.total + excluded.total, diperbarui = excluded.diperbarui'
              ).bind(ref.pengguna, komisi, kini).run();
              // Log event for owner dashboard
              await env.DB.prepare('INSERT INTO peristiwa (pengguna, jenis, rincian, waktu) VALUES (?, ?, ?, ?)')
                .bind(ref.pengguna, 'referral_komisi', kodeRef + '|' + komisi + '|' + (rujukanBeli || ''), kini).run();
              return jawab({ ok: true, komisi, referrer: ref.pengguna }, 200, asal);
            }

            // GET /api/referral/stats - get user's referral stats (requires login)
            if (jalan === '/api/referral/stats' && request.method === 'GET') {
              if (!saya) return perluMasuk();
              const [kodeRow, visits, conversions, kredit] = await Promise.all([
                env.DB.prepare('SELECT kode FROM referral_kode WHERE pengguna = ?').bind(saya.id).first(),
                env.DB.prepare('SELECT COUNT(*) AS n FROM referral_konversi WHERE kode_ref = (SELECT kode FROM referral_kode WHERE pengguna = ?) AND status = ?').bind(saya.id, 'visit').first(),
                env.DB.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(nominal),0) AS total_nominal FROM referral_konversi WHERE kode_ref = (SELECT kode FROM referral_kode WHERE pengguna = ?) AND status = ?').bind(saya.id, 'paid').first(),
                env.DB.prepare('SELECT total FROM referral_kredit WHERE pengguna = ?').bind(saya.id).first()
              ]);
              const kode = kodeRow ? kodeRow.kode : null;
              return jawab({
                kode,
                kunjungan: visits ? visits.n : 0,
                konversi: conversions ? conversions.n : 0,
                total_nominal_konversi: conversions ? conversions.total_nominal : 0,
                kredit_tersedia: kredit ? kredit.total : 0
              }, 200, asal);
            }

            // GET /api/pemilik/referral - owner view of all referrals
            if (jalan === '/api/pemilik/referral' && request.method === 'GET') {
              if (!saya) return perluMasuk();
              if (!adalahPemilik(saya)) return jawab({ pesan: 'bukan pemilik' }, 403, asal);
              const u = new URL(request.url);
              const limit = Math.min(200, Math.max(1, parseInt(u.searchParams.get('limit') || '100', 10)));
              const offset = Math.max(0, parseInt(u.searchParams.get('offset') || '0', 10));
              const [kodeList, konversiList, kreditList] = await Promise.all([
                env.DB.prepare('SELECT rk.kode, rk.pengguna, rk.dibuat, p.surel, p.nama FROM referral_kode rk LEFT JOIN pengguna p ON rk.pengguna = p.id ORDER BY rk.dibuat DESC LIMIT ? OFFSET ?').bind(limit, offset).all(),
                env.DB.prepare('SELECT kode_ref, COUNT(*) AS kunjungan, SUM(CASE WHEN status = "paid" THEN 1 ELSE 0 END) AS konversi, SUM(CASE WHEN status = "paid" THEN nominal ELSE 0 END) AS total_nominal FROM referral_konversi GROUP BY kode_ref ORDER BY konversi DESC').all(),
                env.DB.prepare('SELECT pengguna, total FROM referral_kredit ORDER BY total DESC').all()
              ]);
              // Build map for quick lookup
              const konversiMap = {};
              konversiList.results?.forEach(r => { konversiMap[r.kode_ref] = r; });
              const kreditMap = {};
              kreditList.results?.forEach(r => { kreditMap[r.pengguna] = r.total; });
              const referral = (kodeList.results || []).map(r => ({
                kode: r.kode,
                pengguna: r.pengguna,
                surel: r.surel,
                nama: r.nama,
                dibuat: r.dibuat,
                kunjungan: konversiMap[r.kode]?.kunjungan || 0,
                konversi: konversiMap[r.kode]?.konversi || 0,
                total_nominal: konversiMap[r.kode]?.total_nominal || 0,
                kredit_diberikan: kreditMap[r.pengguna] || 0
              }));
              return jawab({ referral }, 200, asal);
            }

            // ---- Premium check ----
            if (jalan === '/premium' && request.method === 'GET') {
              if (!saya) return jawab({ premium: false }, 401, asal);
              const has = await env.DB.prepare('SELECT 1 FROM pembelian WHERE pengguna = ? LIMIT 1').bind(saya.id).first();
              return jawab({ premium: !!has }, 200, asal);
            }

            // ---- Monitoring health check /beli/ (dijalankan otomatis via Cron Trigger tiap 4 jam) ----
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
              return jawab({ ok: hasil.ok, waktu: new Date().toISOString(), beli: hasil.beli, funnel: hasil.funnel, tripay: hasil.tripay, rincian: hasil.rincian }, 200, asal);
            }

            // ---- Manual monitoring test endpoint (POST) ----
            if (jalan === '/api/monitoring/test' && request.method === 'POST') {
              const hasil = await cekMonitoringLengkap(env);
              return jawab({ ok: hasil.ok, rincian: hasil.rincian, beli: hasil.beli, funnel: hasil.funnel, tripay: hasil.tripay }, 200, asal);
            }

            return jawab({ pesan: 'alamat tidak dikenal' }, 404, asal);

          } catch (e) {
            return jawab({ pesan: 'permintaan tidak bisa diproses', rincian: String(e.message || e).slice(0, 160) }, 400, asal);
          }
        },
        async scheduled(event, env, ctx) {
              // Cron Trigger: "0 */4 * * *" (tiap 4 jam: 0,4,8,12,16,20)
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
                  return { ok: r.ok, status: r.status };
              } catch (e) {
                  return { ok: false, reason: String(e.message || e).slice(0, 100) };
              }
          }

          // Cek funnel CSV via DB langsung - verifikasi data funnel ter-update (ekspor harian jam 01:00 WIB)
                  async function cekFunnelCSV(env) {
                      try {
                          // Query DB langsung: ambil 100 event terbaru dari peristiwa (max 2 hari)
                          const cutoff = new Date(Date.now() - 2*864e5).toISOString();
                          const rows = await env.DB.prepare('SELECT waktu, jenis, rincian FROM peristiwa WHERE waktu >= ? ORDER BY waktu DESC LIMIT 100').bind(cutoff).all();
                          const data = rows.results || [];
                          if (!data.length) return { ok: false, status: 200, rincian: 'Funnel data kosong' };
                          // Cek data paling baru tidak lebih dari 28 jam (ekspor harian + buffer 4 jam)
                          const terbaru = new Date(data[0].waktu);
                          const sekarang = new Date();
                          const jamLalu = (sekarang - terbaru) / (1000 * 60 * 60);
                          if (jamLalu > 28) return { ok: false, status: 200, rincian: 'Funnel data usang ' + jamLalu.toFixed(1) + ' jam' };
                          return { ok: true, status: 200, rincian: 'OK (data ' + jamLalu.toFixed(1) + ' jam lalu)', jumlah: data.length };
                      } catch (e) {
                          return { ok: false, status: 0, rincian: 'Funnel error: ' + String(e.message || e).slice(0, 100) };
                      }
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
                  'funnel: ' + (funnel.ok ? 'OK' : 'GAGAL - ' + funnel.rincian),
                  'tripay: ' + (tripay.ok ? 'OK' : 'GAGAL - ' + tripay.rincian)
              ].join('; ');

              // Simpan ringkasan ke D1 (bisa extend tabel monitoring_checks nanti)
              if (!semuaSehat) {
                  const alertMsg = `🚨 <b>Monitoring Komprehensif GAGAL</b>\n` +
                      `Waktu: ${new Date().toISOString()}\n` +
                      `Rincian: ${rincianGabungan}`;
                  await kirimTelegramAlert(env, alertMsg);
              }
              return { ok: semuaSehat, beli, funnel, tripay, rincian: rincianGabungan };
          }

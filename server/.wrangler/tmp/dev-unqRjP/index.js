var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.js
var SITUS = [
  "https://siappsikotes.my.id",
  "https://www.siappsikotes.my.id",
  "https://arapcihuy.github.io",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
  "https://cardcheck-siapp.pages.dev"
];
var CLIENT_ID = "1093622424912-nmkq3j5boa6tgf834qp6903i8vnet14a.apps.googleusercontent.com";
var PEMILIK = ["rasyidahmad180@gmail.com"];
var KUNCI_GOOGLE_URL = "https://www.googleapis.com/oauth2/v3/certs";
var BATAS_ISI = 2e5;
var UMUR_SESI = 60 * 60 * 24 * 30;
var kunciGoogle = { waktu: 0, daftar: null };
function cors(asal) {
  const ok = SITUS.indexOf(asal) !== -1;
  return {
    "Access-Control-Allow-Origin": ok ? asal : SITUS[0],
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}
__name(cors, "cors");
function jawab(data, status, asal) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign({ "Content-Type": "application/json; charset=utf-8" }, cors(asal))
  });
}
__name(jawab, "jawab");
function dasar64urlKeBytes(s) {
  s = String(s).replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const biner = atob(s);
  const out = new Uint8Array(biner.length);
  for (let i = 0; i < biner.length; i++) out[i] = biner.charCodeAt(i);
  return out;
}
__name(dasar64urlKeBytes, "dasar64urlKeBytes");
function teksKeBase64url(buf) {
  const b = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
__name(teksKeBase64url, "teksKeBase64url");
async function sha256hex(teks) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(teks));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(sha256hex, "sha256hex");
async function ambilKunciGoogle() {
  const kini = Date.now();
  if (kunciGoogle.daftar && kini - kunciGoogle.waktu < 36e5) return kunciGoogle.daftar;
  const r = await fetch(KUNCI_GOOGLE_URL);
  if (!r.ok) throw new Error("tidak bisa mengambil kunci Google");
  const j = await r.json();
  kunciGoogle = { waktu: kini, daftar: j.keys || [] };
  return kunciGoogle.daftar;
}
__name(ambilKunciGoogle, "ambilKunciGoogle");
async function periksaTokenGoogle(idToken) {
  const bagian = String(idToken || "").split(".");
  if (bagian.length !== 3) throw new Error("token tidak berbentuk JWT");
  const kepala = JSON.parse(new TextDecoder().decode(dasar64urlKeBytes(bagian[0])));
  const isi = JSON.parse(new TextDecoder().decode(dasar64urlKeBytes(bagian[1])));
  const kunci = (await ambilKunciGoogle()).find((k) => k.kid === kepala.kid);
  if (!kunci) throw new Error("kunci Google tidak dikenal (kid)");
  const kunciImpor = await crypto.subtle.importKey("jwk", kunci, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const sah = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    kunciImpor,
    dasar64urlKeBytes(bagian[2]),
    new TextEncoder().encode(bagian[0] + "." + bagian[1])
  );
  if (!sah) throw new Error("tanda tangan token tidak sah");
  if (isi.aud !== CLIENT_ID) throw new Error("token bukan untuk aplikasi ini");
  if (isi.iss !== "accounts.google.com" && isi.iss !== "https://accounts.google.com") throw new Error("penerbit token tidak sah");
  if (typeof isi.exp !== "number" || isi.exp * 1e3 < Date.now()) throw new Error("token sudah kedaluwarsa");
  if (typeof isi.email !== "string" || !isi.email) throw new Error("token tidak memuat surel");
  if (isi.email_verified === false) throw new Error("surel Google belum terverifikasi");
  return { id: String(isi.sub), surel: String(isi.email).toLowerCase(), nama: isi.name || "", foto: isi.picture || "" };
}
__name(periksaTokenGoogle, "periksaTokenGoogle");
async function periksaTokenAksesGoogle(accessToken) {
  const t = String(accessToken || "").trim();
  if (t.length < 10) throw new Error("token akses kosong");
  const r = await fetch("https://oauth2.googleapis.com/tokeninfo?access_token=" + encodeURIComponent(t));
  if (!r.ok) throw new Error("token akses tidak sah");
  const p = await r.json();
  if (p.aud !== CLIENT_ID) throw new Error("token bukan untuk aplikasi ini");
  if (String(p.scope || "").indexOf("email") === -1) throw new Error("lingkup token tidak memuat surel");
  if (typeof p.email !== "string" || !p.email) throw new Error("token tidak memuat surel");
  if (p.email_verified === false) throw new Error("surel Google belum terverifikasi");
  if (!p.sub) throw new Error("token tidak memuat id akun");
  return { id: String(p.sub), surel: String(p.email).toLowerCase(), nama: p.name || "", foto: p.picture || "" };
}
__name(periksaTokenAksesGoogle, "periksaTokenAksesGoogle");
async function batasiLaju(env, ip, alamat, batas, jendelaDetik) {
  const jendela = String(Math.floor(Date.now() / (jendelaDetik * 1e3)));
  const kunci = alamat + "|" + ip + "|" + jendela;
  await env.DB.prepare("INSERT INTO batas (kunci, jumlah) VALUES (?, 1) ON CONFLICT(kunci) DO UPDATE SET jumlah = batas.jumlah + 1").bind(kunci).run();
  const baris = await env.DB.prepare("SELECT jumlah FROM batas WHERE kunci = ?").bind(kunci).first();
  const jumlah = baris && baris.jumlah || 1;
  return { boleh: jumlah <= batas, jumlah, batas };
}
__name(batasiLaju, "batasiLaju");
var KUNCI_KODE = ["siap", "psikotes", "2026", "kode"].join("|");
function sidikKode(data) {
  let h = 2166136261;
  const s = String(data) + "#" + KUNCI_KODE;
  for (let i = 0; i < s.length; i++) {
    h = h ^ s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  const pos = h % 1679616;
  const abjad = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let hasil = "";
  let p = pos;
  while (p > 0) {
    hasil = abjad.charAt(p % 36) + hasil;
    p = Math.floor(p / 36);
  }
  while (hasil.length < 4) hasil = "0" + hasil;
  return hasil;
}
__name(sidikKode, "sidikKode");
async function hashKodeTerbit(kode) {
  return await sha256hex("kodet:" + String(kode).toUpperCase());
}
__name(hashKodeTerbit, "hashKodeTerbit");
async function kodeTerbit(env, kode) {
  const hash = await hashKodeTerbit(kode);
  return await env.DB.prepare(
    "SELECT kode_hash, kode_akhir, terbit, dibayar, rujukan, nominal FROM kode_terbit WHERE kode_hash = ?"
  ).bind(hash).first();
}
__name(kodeTerbit, "kodeTerbit");
var HARGA_DASAR = 39e3;
function nominalDariRujukan(rujukan) {
  const m = /^SP-(\d{3})$/.exec(String(rujukan));
  return m ? HARGA_DASAR + parseInt(m[1], 10) : 0;
}
__name(nominalDariRujukan, "nominalDariRujukan");
function kodeDariRujukan(rujukan) {
  const isi = "P" + String(rujukan).toUpperCase().replace(/[^0-9A-Z]/g, "");
  return "SP" + isi + sidikKode(isi);
}
__name(kodeDariRujukan, "kodeDariRujukan");
function statusPesanan(baris) {
  if (!baris) return "tidak_ada";
  if (!baris.dibayar) return "menunggu_bayar";
  return baris.asal === "tripay" ? "lunas" : "menunggu_verifikasi";
}
__name(statusPesanan, "statusPesanan");
function hexKeBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}
__name(hexKeBytes, "hexKeBytes");
async function hmacHex(kunci, teks) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(String(kunci)), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const tanda = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(String(teks)));
  return Array.from(new Uint8Array(tanda)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(hmacHex, "hmacHex");
async function buatTokenKlaim(env, isi) {
  const payload = JSON.stringify(Object.assign({ waktu: Date.now() }, isi));
  const tanda = await hmacHex(env.KLAIM_HMAC_SECRET, payload);
  const tubuh = teksKeBase64url(new TextEncoder().encode(payload).buffer);
  return tubuh + "." + tanda;
}
__name(buatTokenKlaim, "buatTokenKlaim");
async function periksaTokenKlaim(env, token) {
  try {
    const [tubuh, tanda] = String(token || "").split(".");
    if (!tubuh || !tanda || !env.KLAIM_HMAC_SECRET) return null;
    const biner = dasar64urlKeBytes(tubuh);
    const payload = JSON.parse(new TextDecoder().decode(biner));
    const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.KLAIM_HMAC_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const sah = await crypto.subtle.verify("HMAC", k, hexKeBytes(tanda), biner);
    return sah ? payload : null;
  } catch (e) {
    return null;
  }
}
__name(periksaTokenKlaim, "periksaTokenKlaim");
function isiKodeBaru() {
  const teks = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  const b = crypto.getRandomValues(new Uint8Array(12));
  let acak = "";
  for (let i = 0; i < b.length; i++) acak += teks.charAt(b[i] % teks.length);
  return (/* @__PURE__ */ new Date()).toISOString().slice(2, 10).replace(/-/g, "") + acak;
}
__name(isiKodeBaru, "isiKodeBaru");
async function bukaSesi(env, penggunaId, kini) {
  const token = teksKeBase64url(crypto.getRandomValues(new Uint8Array(32))) + "." + teksKeBase64url(crypto.getRandomValues(new Uint8Array(16)));
  const hash = await sha256hex(token);
  const kedaluwarsa = new Date(Date.now() + UMUR_SESI * 1e3).toISOString();
  await env.DB.prepare("INSERT INTO sesi (token_hash, pengguna, dibuat, kedaluwarsa) VALUES (?, ?, ?, ?)").bind(hash, penggunaId, kini, kedaluwarsa).run();
  await env.DB.prepare(
    "DELETE FROM sesi WHERE pengguna = ? AND token_hash NOT IN (SELECT token_hash FROM sesi WHERE pengguna = ? ORDER BY dibuat DESC LIMIT 5)"
  ).bind(penggunaId, penggunaId).run();
  await env.DB.prepare("DELETE FROM sesi WHERE kedaluwarsa < ?").bind(kini).run();
  return token;
}
__name(bukaSesi, "bukaSesi");
function adalahPemilik(pengguna) {
  return PEMILIK.indexOf(pengguna.surel) !== -1;
}
__name(adalahPemilik, "adalahPemilik");
async function sesiDariPermintaan(request, env) {
  const h = request.headers.get("Authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const hash = await sha256hex(m[1].trim());
  const baris = await env.DB.prepare("SELECT pengguna, kedaluwarsa FROM sesi WHERE token_hash = ?").bind(hash).first();
  if (!baris) return null;
  if (baris.kedaluwarsa < (/* @__PURE__ */ new Date()).toISOString()) return null;
  const p = await env.DB.prepare("SELECT id, surel, nama, jalur, target_tanggal FROM pengguna WHERE id = ?").bind(baris.pengguna).first();
  return p || null;
}
__name(sesiDariPermintaan, "sesiDariPermintaan");
function angka(n, batas) {
  const v = parseInt(n, 10);
  if (!isFinite(v) || v < 0) return 0;
  return Math.min(v, batas || 1e6);
}
__name(angka, "angka");
var src_default = {
  async fetch(request, env) {
    const asal = request.headers.get("Origin") || "";
    const url = new URL(request.url);
    const jalan = url.pathname.replace(/\/+$/, "") || "/";
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(asal) });
    if (asal && SITUS.indexOf(asal) === -1) return jawab({ pesan: "asal tidak diizinkan" }, 403, asal);
    try {
      if (jalan === "/api/masuk" && request.method === "POST") {
        const ip = request.headers.get("CF-Connecting-IP") || "tanpa-ip";
        const laju = await batasiLaju(env, ip, "masuk", 10, 60);
        if (!laju.boleh) return jawab({ pesan: "terlalu banyak percobaan, coba lagi nanti" }, 429, asal);
        const badan = await request.json().catch(() => ({}));
        const orang = badan.id_token ? await periksaTokenGoogle(badan.id_token) : await periksaTokenAksesGoogle(badan.access_token);
        const kini = (/* @__PURE__ */ new Date()).toISOString();
        await env.DB.prepare(
          "INSERT INTO pengguna (id, surel, nama, foto, dibuat, terakhir_aktif) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET surel = excluded.surel, nama = excluded.nama, foto = excluded.foto, terakhir_aktif = excluded.terakhir_aktif"
        ).bind(orang.id, orang.surel, orang.nama, orang.foto, kini, kini).run();
        const token = await bukaSesi(env, orang.id, kini);
        await env.DB.prepare("INSERT INTO peristiwa (pengguna, jenis, rincian, waktu) VALUES (?, ?, ?, ?)").bind(orang.id, "masuk", orang.surel, kini).run();
        return jawab({ token, pengguna: { id: orang.id, surel: orang.surel, nama: orang.nama, pemilik: adalahPemilik(orang) } }, 200, asal);
      }
      if (jalan === "/api/ruang/masuk" && request.method === "POST") {
        const ip = request.headers.get("CF-Connecting-IP") || "tanpa-ip";
        const laju = await batasiLaju(env, ip, "ruang", 20, 60);
        if (!laju.boleh) return jawab({ pesan: "terlalu banyak percobaan, coba lagi nanti" }, 429, asal);
        const badan = await request.json().catch(() => ({}));
        const kode = String(badan.kode || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
        if (kode.indexOf("SP") !== 0 || kode.length < 8 || kode.length > 44) {
          return jawab({ pesan: "kode tidak dikenali" }, 400, asal);
        }
        const isi = kode.slice(2, kode.length - 4);
        if (sidikKode(isi) !== kode.slice(-4)) return jawab({ pesan: "kode tidak cocok" }, 400, asal);
        const terbit = await kodeTerbit(env, kode);
        if (!terbit) return jawab({ pesan: "kode tidak terdaftar" }, 400, asal);
        if (!terbit.dibayar) return jawab({ pesan: "kode belum tercatat lunas" }, 400, asal);
        const id = "kode:" + (await sha256hex(kode)).slice(0, 40);
        const kini = (/* @__PURE__ */ new Date()).toISOString();
        await env.DB.prepare(
          "INSERT INTO pengguna (id, surel, nama, foto, dibuat, terakhir_aktif) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET terakhir_aktif = excluded.terakhir_aktif"
        ).bind(id, "kode:" + kode, "Pengguna kode", "", kini, kini).run();
        const token = await bukaSesi(env, id, kini);
        await env.DB.prepare("INSERT INTO peristiwa (pengguna, jenis, rincian, waktu) VALUES (?, ?, ?, ?)").bind(id, "ruang", kode.slice(-6), kini).run();
        return jawab({ token, pengguna: { id, surel: "kode:" + kode, nama: "Pengguna kode", pemilik: false } }, 200, asal);
      }
      if (jalan === "/api/keluar" && request.method === "POST") {
        const h = request.headers.get("Authorization") || "";
        const m = h.match(/^Bearer\s+(.+)$/i);
        if (m) {
          const hash = await sha256hex(m[1].trim());
          await env.DB.prepare("DELETE FROM sesi WHERE token_hash = ?").bind(hash).run();
        }
        return jawab({ ok: true, pesan: "sesi dicabut" }, 200, asal);
      }
      const saya = await sesiDariPermintaan(request, env);
      const perluMasuk = /* @__PURE__ */ __name(() => jawab({ pesan: "perlu masuk" }, 401, asal), "perluMasuk");
      if (request.method === "POST" && saya && jalan !== "/api/keluar") {
        const laju = await batasiLaju(env, String(saya.id), "tulis", 120, 60);
        if (!laju.boleh) return jawab({ pesan: "terlalu cepat, coba lagi sebentar" }, 429, asal);
      }
      if (jalan === "/api/saya" && request.method === "GET") {
        if (!saya) return perluMasuk();
        const [prog, sal, bah, bel, pengguna] = await Promise.all([
          env.DB.prepare("SELECT kategori, benar, salah, terakhir FROM progres WHERE pengguna = ?").bind(saya.id).all(),
          env.DB.prepare("SELECT id_soal, kategori, jumlah, terakhir FROM salah WHERE pengguna = ?").bind(saya.id).all(),
          env.DB.prepare("SELECT jenis, kunci, isi, diperbarui FROM bahan WHERE pengguna = ?").bind(saya.id).all(),
          env.DB.prepare("SELECT kode, rujukan, nominal, tanggal FROM pembelian WHERE pengguna = ?").bind(saya.id).all(),
          env.DB.prepare("SELECT jalur, target_tanggal, terakhir_aktif FROM pengguna WHERE id = ?").bind(saya.id).first()
        ]);
        return jawab({
          pengguna: { id: saya.id, surel: saya.surel, nama: saya.nama, pemilik: adalahPemilik(saya) },
          profil: pengguna || {},
          progres: prog.results || [],
          salah: sal.results || [],
          bahan: bah.results || [],
          pembelian: bel.results || []
        }, 200, asal);
      }
      if (jalan === "/api/progres" && request.method === "POST") {
        if (!saya) return perluMasuk();
        const b = await request.json().catch(() => ({}));
        const kategori = String(b.kategori || "").slice(0, 60);
        if (!kategori) return jawab({ pesan: "kategori wajib" }, 400, asal);
        const kini = (/* @__PURE__ */ new Date()).toISOString();
        await env.DB.prepare(
          "INSERT INTO progres (pengguna, kategori, benar, salah, terakhir) VALUES (?, ?, ?, ?, ?) ON CONFLICT(pengguna, kategori) DO UPDATE SET benar = excluded.benar, salah = excluded.salah, terakhir = excluded.terakhir"
        ).bind(saya.id, kategori, angka(b.benar), angka(b.salah), kini).run();
        await env.DB.prepare("UPDATE pengguna SET terakhir_aktif = ? WHERE id = ?").bind(kini, saya.id).run();
        return jawab({ ok: true }, 200, asal);
      }
      if (jalan === "/api/salah" && request.method === "POST") {
        if (!saya) return perluMasuk();
        const b = await request.json().catch(() => ({}));
        const idSoal = String(b.id_soal || "").slice(0, 80);
        if (!idSoal) return jawab({ pesan: "id_soal wajib" }, 400, asal);
        const kini = (/* @__PURE__ */ new Date()).toISOString();
        await env.DB.prepare(
          "INSERT INTO salah (pengguna, id_soal, kategori, jumlah, terakhir) VALUES (?, ?, ?, 1, ?) ON CONFLICT(pengguna, id_soal) DO UPDATE SET jumlah = salah.jumlah + 1, terakhir = excluded.terakhir"
        ).bind(saya.id, idSoal, String(b.kategori || "").slice(0, 60), kini).run();
        await env.DB.prepare("UPDATE pengguna SET terakhir_aktif = ? WHERE id = ?").bind(kini, saya.id).run();
        return jawab({ ok: true }, 200, asal);
      }
      if (jalan === "/api/bahan" && request.method === "POST") {
        if (!saya) return perluMasuk();
        const b = await request.json().catch(() => ({}));
        const jenis = String(b.jenis || "").slice(0, 40);
        const kunci = String(b.kunci || "").slice(0, 80);
        const isi = typeof b.isi === "string" ? b.isi : JSON.stringify(b.isi || null);
        if (!jenis || !kunci) return jawab({ pesan: "jenis dan kunci wajib" }, 400, asal);
        if (isi.length > BATAS_ISI) return jawab({ pesan: "isi terlalu besar" }, 413, asal);
        const kini = (/* @__PURE__ */ new Date()).toISOString();
        await env.DB.prepare(
          "INSERT INTO bahan (pengguna, jenis, kunci, isi, diperbarui) VALUES (?, ?, ?, ?, ?) ON CONFLICT(pengguna, jenis, kunci) DO UPDATE SET isi = excluded.isi, diperbarui = excluded.diperbarui"
        ).bind(saya.id, jenis, kunci, isi, kini).run();
        return jawab({ ok: true }, 200, asal);
      }
      if (jalan === "/api/bahan/hapus" && request.method === "POST") {
        if (!saya) return perluMasuk();
        const b = await request.json().catch(() => ({}));
        const kunci = String(b.kunci || "").slice(0, 80);
        if (!kunci) return jawab({ pesan: "kunci wajib" }, 400, asal);
        await env.DB.prepare("DELETE FROM bahan WHERE pengguna = ? AND kunci = ?").bind(saya.id, kunci).run();
        return jawab({ ok: true }, 200, asal);
      }
      if (jalan === "/api/bahan/semua/hapus" && request.method === "POST") {
        if (!saya) return perluMasuk();
        await env.DB.prepare("DELETE FROM bahan WHERE pengguna = ?").bind(saya.id).run();
        return jawab({ ok: true }, 200, asal);
      }
      if (jalan === "/api/pembelian" && request.method === "POST") {
        if (!saya) return perluMasuk();
        const b = await request.json().catch(() => ({}));
        const kode = String(b.kode || "").toUpperCase().slice(0, 40);
        if (!kode) return jawab({ pesan: "kode wajib" }, 400, asal);
        const terbit = await kodeTerbit(env, kode);
        if (!terbit || !terbit.dibayar) return jawab({ pesan: "kode tidak terdaftar" }, 400, asal);
        const kini = (/* @__PURE__ */ new Date()).toISOString();
        await env.DB.prepare(
          "INSERT INTO pembelian (pengguna, kode, rujukan, nominal, tanggal) VALUES (?, ?, ?, ?, ?) ON CONFLICT(pengguna, kode) DO UPDATE SET rujukan = excluded.rujukan, nominal = excluded.nominal"
        ).bind(saya.id, kode, String(terbit.rujukan || "").slice(0, 20), Number(terbit.nominal) || 0, kini).run();
        await env.DB.prepare("INSERT INTO peristiwa (pengguna, jenis, rincian, waktu) VALUES (?, ?, ?, ?)").bind(saya.id, "pembelian", kode, kini).run();
        return jawab({ ok: true }, 200, asal);
      }
      if (jalan === "/api/profil" && request.method === "POST") {
        if (!saya) return perluMasuk();
        const b = await request.json().catch(() => ({}));
        await env.DB.prepare("UPDATE pengguna SET jalur = ?, target_tanggal = ?, terakhir_aktif = ? WHERE id = ?").bind(String(b.jalur || "").slice(0, 40), String(b.target_tanggal || "").slice(0, 10), (/* @__PURE__ */ new Date()).toISOString(), saya.id).run();
        return jawab({ ok: true }, 200, asal);
      }
      if (jalan === "/api/hapus-data-saya" && request.method === "POST") {
        if (!saya) return perluMasuk();
        await env.DB.prepare("DELETE FROM progres WHERE pengguna = ?").bind(saya.id).run();
        await env.DB.prepare("DELETE FROM salah WHERE pengguna = ?").bind(saya.id).run();
        await env.DB.prepare("DELETE FROM bahan WHERE pengguna = ?").bind(saya.id).run();
        await env.DB.prepare("DELETE FROM pembelian WHERE pengguna = ?").bind(saya.id).run();
        await env.DB.prepare("DELETE FROM sesi WHERE pengguna = ?").bind(saya.id).run();
        await env.DB.prepare("DELETE FROM pengguna WHERE id = ?").bind(saya.id).run();
        return jawab({ ok: true, pesan: "seluruh data kamu sudah dihapus" }, 200, asal);
      }
      if (jalan === "/api/unduh-data-saya" && request.method === "GET") {
        if (!saya) return perluMasuk();
        const [prog, sal, bah, bel] = await Promise.all([
          env.DB.prepare("SELECT kategori, benar, salah, terakhir FROM progres WHERE pengguna = ?").bind(saya.id).all(),
          env.DB.prepare("SELECT id_soal, kategori, jumlah, terakhir FROM salah WHERE pengguna = ?").bind(saya.id).all(),
          env.DB.prepare("SELECT jenis, kunci, isi, diperbarui FROM bahan WHERE pengguna = ?").bind(saya.id).all(),
          env.DB.prepare("SELECT kode, rujukan, nominal, tanggal FROM pembelian WHERE pengguna = ?").bind(saya.id).all()
        ]);
        return jawab({
          pengguna: { surel: saya.surel, nama: saya.nama },
          progres: prog.results,
          salah: sal.results,
          bahan: bah.results,
          pembelian: bel.results
        }, 200, asal);
      }
      if (jalan === "/api/pemilik/ringkasan" && request.method === "GET") {
        if (!saya) return perluMasuk();
        if (!adalahPemilik(saya)) return jawab({ pesan: "bukan pemilik" }, 403, asal);
        const jumlah = await env.DB.prepare("SELECT COUNT(*) AS n FROM pengguna").first();
        const hariIni = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
        const aktifHariIni = await env.DB.prepare("SELECT COUNT(*) AS n FROM pengguna WHERE substr(terakhir_aktif,1,10) = ?").bind(hariIni).first();
        const daftar = await env.DB.prepare(
          "SELECT p.surel, p.nama, p.jalur, p.terakhir_aktif, (SELECT COALESCE(SUM(benar),0) FROM progres WHERE pengguna = p.id) AS total_benar, (SELECT COALESCE(SUM(salah),0) FROM progres WHERE pengguna = p.id) AS total_salah, (SELECT COUNT(*) FROM pembelian WHERE pengguna = p.id) AS jumlah_pembelian FROM pengguna p ORDER BY p.terakhir_aktif DESC LIMIT 200"
        ).all();
        return jawab({ total_pengguna: jumlah.n, aktif_hari_ini: aktifHariIni.n, pengguna: daftar.results || [] }, 200, asal);
      }
      if (jalan === "/api/pemilik/kode-terbit" && request.method === "POST") {
        if (!saya) return perluMasuk();
        if (!adalahPemilik(saya)) return jawab({ pesan: "bukan pemilik" }, 403, asal);
        const b = await request.json().catch(() => ({}));
        const nominal = Math.round(Number(b.nominal));
        const rujukan = String(b.rujukan || "").trim().slice(0, 40);
        const jumlah = Math.min(Math.max(parseInt(b.jumlah, 10) || 1, 1), 50);
        if (!isFinite(nominal) || nominal <= 0) return jawab({ pesan: "nominal setoran wajib" }, 400, asal);
        if (!rujukan) return jawab({ pesan: "rujukan setoran wajib" }, 400, asal);
        const kini = (/* @__PURE__ */ new Date()).toISOString();
        const kode = [];
        for (let i = 0; i < jumlah; i++) {
          let k = "", isi = "", coba = 0;
          do {
            isi = isiKodeBaru();
            k = "SP" + isi + sidikKode(isi);
            coba++;
          } while (coba < 8 && await kodeTerbit(env, k));
          await env.DB.prepare(
            "INSERT INTO kode_terbit (kode_hash, kode_akhir, terbit, dibayar, rujukan, nominal, asal) VALUES (?, ?, ?, ?, ?, ?, ?)"
          ).bind(await hashKodeTerbit(k), k.slice(-6), kini, kini, rujukan, nominal, "pemilik").run();
          kode.push(k);
        }
        await env.DB.prepare("INSERT INTO peristiwa (pengguna, jenis, rincian, waktu) VALUES (?, ?, ?, ?)").bind(saya.id, "kode-terbit", rujukan + "|" + nominal + "|" + kode.length, kini).run();
        return jawab({ ok: true, kode, rujukan, nominal }, 200, asal);
      }
      if (jalan === "/api/pantau" && request.method === "POST") {
        const ip = request.headers.get("CF-Connecting-IP") || "tanpa-ip";
        const laju = await batasiLaju(env, ip, "pantau", 60, 60);
        if (!laju.boleh) return jawab({ pesan: "terlalu sering" }, 429, asal);
        const b = await request.json().catch(() => ({}));
        const JENIS_PANTAU = [
          "kunjungan_beli",
          "klik_cta_bayar",
          "salin_nominal",
          "tampilkan_kode",
          "salin_kode",
          "salin_rujukan",
          "qris_tampil",
          "buka_aplikasi",
          "klik_bukti_wa",
          "klik_bukti_email",
          "klaim_sudah_bayar",
          "cardcheck_kunjungan",
          "cardcheck_klik_cta",
          "survei_kunjungan",
          "artikel_pageview"
        ];
        const jenis = String(b.jenis || "");
        if (JENIS_PANTAU.indexOf(jenis) === -1) return jawab({ pesan: "jenis tidak dikenal" }, 400, asal);
        const kartu = jenis.indexOf("cardcheck_") === 0;
        const rincian = String(b.rujukan || "").slice(0, 20);
        if (rincian && !(kartu ? /^[A-Za-z0-9_-]{1,20}$/.test(rincian) : /^SP-[0-9]{3}$/.test(rincian)))
          return jawab({ pesan: "rincian tidak sah" }, 400, asal);
        const awalan = kartu ? "cardcheck:" : "beli:";
        const utmSource = String(b.utm_source || "").slice(0, 50);
        const utmMedium = String(b.utm_medium || "").slice(0, 50);
        const utmCampaign = String(b.utm_campaign || "").slice(0, 100);
        await env.DB.prepare("INSERT INTO peristiwa (pengguna, jenis, rincian, waktu, utm_source, utm_medium, utm_campaign) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(null, awalan + jenis, rincian, (/* @__PURE__ */ new Date()).toISOString(), utmSource, utmMedium, utmCampaign).run();
        return jawab({ ok: true }, 200, asal);
      }
      if (jalan === "/api/payment-webhook" && request.method === "POST") {
        const ip = request.headers.get("CF-Connecting-IP") || "tanpa-ip";
        const laju = await batasiLaju(env, ip, "payment_webhook", 30, 60);
        if (!laju.boleh) return jawab({ pesan: "terlalu sering" }, 429, asal);
        const b = await request.json().catch(() => ({}));
        const timestamp = (/* @__PURE__ */ new Date()).toISOString();
        const utmSource = String(b.utm_source || "").slice(0, 50);
        const utmMedium = String(b.utm_medium || "").slice(0, 50);
        const product = String(b.product || "siappsikotes").slice(0, 50);
        const amount = Math.round(Number(b.amount)) || 39e3;
        const status = String(b.status || "success").slice(0, 20);
        const txid = String(b.txid || "").slice(0, 100);
        const rawPayload = JSON.stringify(b).slice(0, 5e3);
        const isTest = ["test", "audit"].indexOf(utmSource.toLowerCase()) !== -1 || b.probe === 1 || b.probe === "1" ? 1 : 0;
        await env.DB.prepare(
          "INSERT INTO payments (timestamp, utm_source, utm_medium, product, amount, status, txid, raw_payload, is_test, rujukan) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).bind(timestamp, utmSource, utmMedium, product, amount, status, txid, rawPayload, isTest, String(b.rujukan || "").slice(0, 20) || null).run();
        if ((status === "success" || status === "paid") && !isTest) {
          const alertMsg = `\u2705 <b>Pembayaran Baru</b>
Produk: ${product}
Jumlah: Rp ${amount.toLocaleString()}
UTM: ${utmSource} / ${utmMedium}
TXID: ${txid || "-"}
Waktu: ${timestamp}`;
          await kirimTelegramAlert(env, alertMsg);
        }
        return jawab({ ok: true }, 200, asal);
      }
      if (jalan === "/api/beli/kode" && request.method === "POST") {
        const ip = request.headers.get("CF-Connecting-IP") || "tanpa-ip";
        const laju = await batasiLaju(env, ip, "beli_kode", 20, 60);
        if (!laju.boleh) return jawab({ pesan: "terlalu sering" }, 429, asal);
        const b = await request.json().catch(() => ({}));
        const rujukan = String(b.rujukan || "").toUpperCase().trim().slice(0, 12);
        if (!/^SP-\d{3}$/.test(rujukan)) return jawab({ pesan: "rujukan tidak sah (harus SP-3digit)" }, 400, asal);
        const nominal = nominalDariRujukan(rujukan);
        const kini = (/* @__PURE__ */ new Date()).toISOString();
        const kode = kodeDariRujukan(rujukan);
        const hash = await hashKodeTerbit(kode);
        await env.DB.prepare(
          "INSERT INTO kode_terbit (kode_hash, kode_akhir, terbit, dibayar, rujukan, nominal, asal) VALUES (?, ?, ?, NULL, ?, ?, ?) ON CONFLICT(kode_hash) DO NOTHING"
        ).bind(hash, kode.slice(-6), kini, rujukan, nominal, "menunggu-bayar").run();
        const baris = await env.DB.prepare("SELECT dibayar, asal FROM kode_terbit WHERE kode_hash = ?").bind(hash).first();
        await env.DB.prepare("INSERT INTO peristiwa (pengguna, jenis, rincian, waktu, utm_source, utm_medium, utm_campaign) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(null, "beli:order", rujukan + "|" + nominal, kini, String(b.utm_source || "").slice(0, 50), String(b.utm_medium || "").slice(0, 50), String(b.utm_campaign || "").slice(0, 100)).run();
        const klaim_token = env.KLAIM_HMAC_SECRET ? await buatTokenKlaim(env, { rujukan, nominal }) : null;
        return jawab({
          ok: true,
          rujukan,
          nominal,
          kode,
          status: statusPesanan(baris),
          klaim_token,
          tripay_aktif: !!(env.TRIPAY_API_KEY && env.TRIPAY_PRIVATE_KEY && env.TRIPAY_KODE_MERCHANT)
        }, 200, asal);
      }
      if (jalan === "/api/beli/klaim" && request.method === "POST") {
        const ip = request.headers.get("CF-Connecting-IP") || "tanpa-ip";
        const laju = await batasiLaju(env, ip, "beli_klaim", 10, 60);
        if (!laju.boleh) return jawab({ pesan: "terlalu sering" }, 429, asal);
        if (!env.KLAIM_HMAC_SECRET) return jawab({ pesan: "verifikasi klaim belum aktif" }, 503, asal);
        const b = await request.json().catch(() => ({}));
        const rujukan = String(b.rujukan || "").toUpperCase().trim().slice(0, 12);
        if (!/^SP-\d{3}$/.test(rujukan)) return jawab({ pesan: "rujukan tidak sah" }, 400, asal);
        const isi = await periksaTokenKlaim(env, b.klaim_token);
        if (!isi || isi.rujukan !== rujukan) return jawab({ pesan: "token klaim tidak sah \u2014 tekan dulu Tampilkan kode" }, 400, asal);
        if (Date.now() - (isi.waktu || 0) > 48 * 36e5) return jawab({ pesan: "token klaim kedaluwarsa \u2014 muat ulang halaman" }, 400, asal);
        const hash = await hashKodeTerbit(kodeDariRujukan(rujukan));
        const kini = (/* @__PURE__ */ new Date()).toISOString();
        const hasil = await env.DB.prepare("UPDATE kode_terbit SET dibayar = ?, asal = 'klaim' WHERE kode_hash = ? AND dibayar IS NULL").bind(kini, hash).run();
        const baris = await env.DB.prepare("SELECT dibayar, asal, nominal FROM kode_terbit WHERE kode_hash = ?").bind(hash).first();
        if (!baris) return jawab({ pesan: "pesanan tidak ditemukan \u2014 tekan dulu Tampilkan kode" }, 404, asal);
        if (hasil.meta.changes > 0) {
          await env.DB.prepare("INSERT INTO peristiwa (pengguna, jenis, rincian, waktu) VALUES (?, ?, ?, ?)").bind(null, "beli:klaim_bayar", rujukan + "|" + baris.nominal, kini).run();
          await kirimTelegramAlert(env, '\u{1F9FE} <b>Klaim "sudah bayar" diterima</b>\nRujukan: ' + rujukan + "\nNominal: Rp " + Number(baris.nominal).toLocaleString("id-ID") + "\nKode akses: AKTIF (status menunggu verifikasi harian)");
        }
        return jawab({ ok: true, status: statusPesanan(baris), pesan: "kode aktif \u2014 pembayaran dicocokkan otomatis di laporan harian" }, 200, asal);
      }
      if (jalan === "/api/beli/status" && request.method === "GET") {
        const rujukan = (url.searchParams.get("rujukan") || "").toUpperCase().trim().slice(0, 12);
        if (!/^SP-\d{3}$/.test(rujukan)) return jawab({ pesan: "rujukan tidak sah" }, 400, asal);
        const baris = await env.DB.prepare("SELECT dibayar, asal, nominal FROM kode_terbit WHERE kode_hash = ?").bind(await hashKodeTerbit(kodeDariRujukan(rujukan))).first();
        return jawab({ ok: true, rujukan, status: statusPesanan(baris), nominal: baris ? baris.nominal : nominalDariRujukan(rujukan) }, 200, asal);
      }
      if (jalan === "/api/tripay/webhook" && request.method === "POST") {
        const ip = request.headers.get("CF-Connecting-IP") || "tanpa-ip";
        const laju = await batasiLaju(env, ip, "tripay_webhook", 120, 60);
        if (!laju.boleh) return jawab({ pesan: "terlalu sering" }, 429, asal);
        if (!env.TRIPAY_PRIVATE_KEY) return jawab({ pesan: "Tripay belum dikonfigurasi" }, 503, asal);
        const raw = await request.text();
        const tanda = request.headers.get("X-Callback-Signature") || "";
        let sah = false;
        try {
          const kunci = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.TRIPAY_PRIVATE_KEY), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
          sah = await crypto.subtle.verify("HMAC", kunci, hexKeBytes(tanda), new TextEncoder().encode(raw));
        } catch (e) {
          sah = false;
        }
        if (!sah) return jawab({ pesan: "signature tidak sah" }, 401, asal);
        const b = JSON.parse(raw);
        const kini = (/* @__PURE__ */ new Date()).toISOString();
        const rujukan = String(b.merchant_ref || "").toUpperCase().trim().slice(0, 12);
        const nominal = Math.round(Number(b.payment_amount || b.amount || 0)) || 0;
        const status = String(b.status || "").toUpperCase();
        await env.DB.prepare(
          "INSERT INTO payments (timestamp, utm_source, utm_medium, product, amount, status, txid, raw_payload, is_test, rujukan) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)"
        ).bind(
          kini,
          "tripay",
          String(b.payment_method || "").slice(0, 50),
          "siappsikotes",
          nominal,
          status === "PAID" ? "paid" : status.toLowerCase().slice(0, 20),
          String(b.reference || "").slice(0, 100),
          raw.slice(0, 5e3),
          rujukan || null
        ).run();
        if (status === "PAID" && /^SP-\d{3}$/.test(rujukan) && nominal === nominalDariRujukan(rujukan)) {
          const hash = await hashKodeTerbit(kodeDariRujukan(rujukan));
          const hasil = await env.DB.prepare("UPDATE kode_terbit SET dibayar = ?, asal = 'tripay' WHERE kode_hash = ? AND dibayar IS NULL").bind(kini, hash).run();
          await env.DB.prepare("INSERT INTO peristiwa (pengguna, jenis, rincian, waktu) VALUES (?, ?, ?, ?)").bind(null, "beli:bayar_terkonfirmasi", rujukan + "|" + nominal, kini).run();
          await kirimTelegramAlert(env, "\u{1F4B0} <b>Pembayaran QRIS terkonfirmasi otomatis</b>\nRujukan: " + rujukan + "\nNominal: Rp " + nominal.toLocaleString("id-ID") + "\nTripay ref: " + (b.reference || "-") + "\nKode akses: AKTIF (terbuka otomatis di halaman beli)");
          return jawab({ success: true, kode_dibayar: hasil.meta.changes > 0 ? "dibayar" : "sudah-dibayar-sebelumnya" });
        }
        await kirimTelegramAlert(env, "\u26A0\uFE0F <b>Webhook Tripay belum cocok dengan pesanan</b>\nRujukan: " + rujukan + "\nNominal: Rp " + nominal.toLocaleString("id-ID") + "\nStatus: " + (status || "-"));
        return jawab({ success: true, cocok: false });
      }
      if (jalan === "/api/tripay/transaksi" && request.method === "POST") {
        const ip = request.headers.get("CF-Connecting-IP") || "tanpa-ip";
        const laju = await batasiLaju(env, ip, "tripay_buat", 20, 60);
        if (!laju.boleh) return jawab({ pesan: "terlalu sering" }, 429, asal);
        if (!env.TRIPAY_API_KEY || !env.TRIPAY_PRIVATE_KEY || !env.TRIPAY_KODE_MERCHANT)
          return jawab({ pesan: "Tripay belum dikonfigurasi \u2014 pakai QRIS statis dulu" }, 503, asal);
        const b = await request.json().catch(() => ({}));
        const rujukan = String(b.rujukan || "").toUpperCase().trim().slice(0, 12);
        if (!/^SP-\d{3}$/.test(rujukan)) return jawab({ pesan: "rujukan tidak sah" }, 400, asal);
        const nominal = nominalDariRujukan(rujukan);
        const tanda = await hmacHex(env.TRIPAY_PRIVATE_KEY, env.TRIPAY_KODE_MERCHANT + rujukan + nominal);
        const dasarApi = String(env.TRIPAY_MODE || "") === "sandbox" ? "https://tripay.co.id/api-sandbox" : "https://tripay.co.id/api";
        let d = null;
        try {
          const r = await fetch(dasarApi + "/transaction/create", {
            method: "POST",
            headers: { "Authorization": "Bearer " + env.TRIPAY_API_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({
              method: "QRIS",
              merchant_ref: rujukan,
              amount: nominal,
              customer_name: String(b.nama || "Pembeli SiapPsikotes").slice(0, 60),
              customer_email: String(b.email || "pembeli@siappsikotes.my.id").slice(0, 80),
              signature: tanda,
              expired_time: Math.floor(Date.now() / 1e3) + 86400,
              order_items: [{ sku: "SIAAP-PREMIUM", name: "Akses premium SiapPsikotes", price: nominal, quantity: 1 }]
            })
          });
          d = await r.json().catch(() => null);
          if (!r.ok || !d || d.success === false) d = null;
        } catch (e) {
          d = null;
        }
        if (!d) return jawab({ pesan: "Tripay sedang tidak bisa dihubungi \u2014 pakai QRIS statis dulu" }, 502, asal);
        return jawab({
          ok: true,
          rujukan,
          nominal,
          reference: d.data && d.data.reference,
          pay_url: d.data && d.data.pay_url,
          qr_url: d.data && d.data.qr_url,
          qr_image: d.data && d.data.qr_image,
          expired_time: d.data && d.data.expired_time
        }, 200, asal);
      }
      if (jalan === "/api/pemilik/funnel-beli" && request.method === "GET") {
        if (!saya) return perluMasuk();
        if (!adalahPemilik(saya)) return jawab({ pesan: "bukan pemilik" }, 403, asal);
        const perJenis = await env.DB.prepare(
          "SELECT jenis, COUNT(*) AS n, COUNT(DISTINCT rincian) AS rujukan_unik FROM peristiwa WHERE jenis LIKE 'beli:%' GROUP BY jenis ORDER BY jenis"
        ).all();
        const perHari = await env.DB.prepare(
          "SELECT substr(waktu,1,10) AS hari, jenis, COUNT(*) AS n FROM peristiwa WHERE jenis LIKE 'beli:%' GROUP BY hari, jenis ORDER BY hari DESC, jenis LIMIT 400"
        ).all();
        return jawab({ per_jenis: perJenis.results || [], per_hari: perHari.results || [] }, 200, asal);
      }
      if (jalan === "/api/pemilik/kode-terbit" && request.method === "GET") {
        if (!saya) return perluMasuk();
        if (!adalahPemilik(saya)) return jawab({ pesan: "bukan pemilik" }, 403, asal);
        const daftar = await env.DB.prepare(
          "SELECT kode_akhir, terbit, dibayar, rujukan, nominal, asal FROM kode_terbit ORDER BY terbit DESC LIMIT 200"
        ).all();
        const jumlah = await env.DB.prepare("SELECT COUNT(*) AS n FROM kode_terbit").first();
        const lunas = await env.DB.prepare("SELECT COUNT(*) AS n FROM kode_terbit WHERE dibayar IS NOT NULL").first();
        const nilai = await env.DB.prepare("SELECT COALESCE(SUM(nominal),0) AS n FROM kode_terbit WHERE dibayar IS NOT NULL").first();
        return jawab({
          jumlah_terbit: jumlah.n,
          jumlah_lunas: lunas.n,
          nominal_lunas: nilai.n,
          kode: daftar.results || []
        }, 200, asal);
      }
      if (["GET", "POST"].indexOf(request.method) === -1) {
        return jawab({ pesan: "metode tidak diizinkan" }, 405, asal);
      }
      if (jalan === "/api/laporan/funnel" && request.method === "GET") {
        const u = new URL(request.url);
        const token = u.searchParams.get("token") || (request.headers.get("X-Token") || "");
        if (!env.LAPORAN_TOKEN || token !== env.LAPORAN_TOKEN) return jawab({ pesan: "token tidak sah" }, 403, asal);
        const day = Math.min(90, Math.max(1, parseInt(u.searchParams.get("hari") || "30", 10))) || 30;
        const cutoff = new Date(Date.now() - day * 864e5).toISOString();
        const rows = await env.DB.prepare("SELECT waktu, jenis, rincian FROM peristiwa WHERE waktu >= ? ORDER BY waktu DESC LIMIT 5000").bind(cutoff).all();
        const data = rows.results || [];
        if ((u.searchParams.get("format") || "json") === "csv") {
          const csv = ["waktu,jenis,rincian"].concat(data.map((r) => [
            '"' + r.waktu.replace(/\"/g, '""') + '"',
            '"' + r.jenis.replace(/\"/g, '""') + '"',
            '"' + (r.rincian || "").replace(/\"/g, '""') + '"'
          ].join(","))).join("\n") + "\n";
          return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="funnel.csv"' } });
        }
        return jawab({ hari: day, hasil: data.map((r) => ({ waktu: r.waktu, jenis: r.jenis, rincian: r.rincian || "" })) }, 200, asal);
      }
      if (jalan === "/api/dashboard/stats" && request.method === "GET") {
        const hariIni = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
        const kemarin = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
        const mingguLalu = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
        const [kunjungan, klikBeli, pembayaranSukses, revenueHariIni, conversionRate] = await Promise.all([
          // Kunjungan unik hari ini (event kunjungan_beli)
          env.DB.prepare(
            "SELECT COUNT(DISTINCT rincian) AS n FROM peristiwa WHERE jenis = 'beli:kunjungan_beli' AND substr(waktu,1,10) = ?"
          ).bind(hariIni).first(),
          // Klik CTA bayar hari ini
          env.DB.prepare(
            "SELECT COUNT(DISTINCT rincian) AS n FROM peristiwa WHERE jenis = 'beli:klik_cta_bayar' AND substr(waktu,1,10) = ?"
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
            "SELECT   (SELECT COUNT(*) FROM payments WHERE status IN ('success','paid') AND is_test = 0 AND substr(timestamp,1,10) = ?) * 100.0 /   NULLIF((SELECT COUNT(DISTINCT rincian) FROM peristiwa WHERE jenis = 'beli:kunjungan_beli' AND substr(waktu,1,10) = ?), 0) AS rate"
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
      if (jalan === "/api/dashboard/conversion" && request.method === "GET") {
        const u = new URL(request.url);
        const days = Math.min(30, Math.max(1, parseInt(u.searchParams.get("days") || "7", 10)));
        const cutoff = new Date(Date.now() - days * 864e5).toISOString();
        const rows = await env.DB.prepare(
          "SELECT   substr(waktu,1,10) AS hari,   COUNT(DISTINCT CASE WHEN jenis = 'beli:kunjungan_beli' THEN rincian END) AS kunjungan,   COUNT(DISTINCT CASE WHEN jenis = 'beli:klik_cta_bayar' THEN rincian END) AS klik_beli,   (SELECT COUNT(*) FROM payments p WHERE p.status IN ('success','paid') AND p.is_test = 0 AND substr(p.timestamp,1,10) = substr(pe.waktu,1,10)) AS pembayaran,   (SELECT COALESCE(SUM(amount),0) FROM payments p WHERE p.status IN ('success','paid') AND p.is_test = 0 AND substr(p.timestamp,1,10) = substr(pe.waktu,1,10)) AS revenue FROM peristiwa pe WHERE pe.waktu >= ? AND pe.jenis LIKE 'beli:%' GROUP BY substr(pe.waktu,1,10) ORDER BY hari DESC"
        ).bind(cutoff).all();
        const data = (rows.results || []).map((r) => ({
          hari: r.hari,
          kunjungan: r.kunjungan || 0,
          klik_beli: r.klik_beli || 0,
          pembayaran: r.pembayaran || 0,
          revenue: r.revenue || 0,
          conversion_rate: r.kunjungan ? Number((r.pembayaran / r.kunjungan * 100).toFixed(2)) : 0
        }));
        return jawab({ days, data }, 200, asal);
      }
      if (jalan === "/api/dashboard/funnel-csv" && request.method === "GET") {
        const u = new URL(request.url);
        const days = Math.min(90, Math.max(1, parseInt(u.searchParams.get("days") || "30", 10)));
        const sejak = new Date(Date.now() - (days - 1) * 864e5).toISOString().slice(0, 10);
        const [pe, pay] = await Promise.all([
          env.DB.prepare(
            "SELECT substr(waktu,1,10) AS hari, COUNT(DISTINCT CASE WHEN jenis = 'beli:kunjungan_beli' THEN rincian END) AS kunjungan, COUNT(DISTINCT CASE WHEN jenis = 'beli:klik_cta_bayar' THEN rincian END) AS klik FROM peristiwa WHERE jenis LIKE 'beli:%' AND substr(waktu,1,10) >= ? GROUP BY substr(waktu,1,10)"
          ).bind(sejak).all(),
          env.DB.prepare(
            "SELECT substr(timestamp,1,10) AS hari, COUNT(*) AS bayar, COALESCE(SUM(amount),0) AS revenue FROM payments WHERE status IN ('success','paid') AND is_test = 0 AND substr(timestamp,1,10) >= ? GROUP BY substr(timestamp,1,10)"
          ).bind(sejak).all()
        ]);
        const mapHari = {};
        for (const r of pe.results || []) {
          mapHari[r.hari] = { kunjungan: r.kunjungan || 0, klik: r.klik || 0, bayar: 0, revenue: 0 };
        }
        for (const r of pay.results || []) {
          if (!mapHari[r.hari]) mapHari[r.hari] = { kunjungan: 0, klik: 0, bayar: 0, revenue: 0 };
          mapHari[r.hari].bayar = r.bayar || 0;
          mapHari[r.hari].revenue = r.revenue || 0;
        }
        const daftar = Object.keys(mapHari).sort().reverse();
        const csv = "hari,kunjungan,klik_bayar,bayar_qris,konversi_pct,revenue_rp\n" + daftar.map((h) => {
          const d = mapHari[h];
          const conv = d.kunjungan ? (d.bayar / d.kunjungan * 100).toFixed(2) : "0.00";
          return h + "," + d.kunjungan + "," + d.klik + "," + d.bayar + "," + conv + "," + d.revenue;
        }).join("\n") + "\n";
        return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="funnel-harian.csv"' } });
      }
      if (jalan === "/api/dashboard/laporan-coba" && request.method === "POST") {
        const hasil = await laporanHarian(env);
        return jawab({ ok: !!hasil.ok, tg: hasil.tg, ringkasan: hasil.ringkasan }, 200, asal);
      }
      if (jalan === "/api/funnel" && request.method === "GET") {
        let snap = null;
        try {
          snap = await env.FUNNEL_KV.get("funnel:terkini");
        } catch (e) {
          snap = null;
        }
        if (snap) {
          let data2;
          try {
            data2 = JSON.parse(snap);
          } catch (e) {
            data2 = null;
          }
          if (data2) return jawab(data2, 200, asal);
        }
        const data = await funnelHarianJson(env);
        try {
          const tersimpan = Object.assign({}, data, { sumber: "snapshot-kv" });
          await env.FUNNEL_KV.put("funnel:terkini", JSON.stringify(tersimpan));
        } catch (e) {
        }
        data.sumber = "live-d1";
        return jawab(data, 200, asal);
      }
      if (jalan === "/" || jalan === "/sehat") {
        return jawab({ aplikasi: "SiapPsikotes API", keadaan: "hidup", waktu: (/* @__PURE__ */ new Date()).toISOString() }, 200, asal);
      }
      if (jalan === "/api/referral/kode" && request.method === "GET") {
        if (!saya) return perluMasuk();
        const existing = await env.DB.prepare("SELECT kode FROM referral_kode WHERE pengguna = ?").bind(saya.id).first();
        if (existing) {
          return jawab({ kode: existing.kode }, 200, asal);
        }
        const chars = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
        let kode = "SPRF";
        let unique = false;
        let attempts = 0;
        while (!unique && attempts < 10) {
          const b = crypto.getRandomValues(new Uint8Array(8));
          let suffix = "";
          for (let i = 0; i < b.length; i++) suffix += chars.charAt(b[i] % chars.length);
          const kandidat = kode + suffix;
          const cek = await env.DB.prepare("SELECT 1 FROM referral_kode WHERE kode = ?").bind(kandidat).first();
          if (!cek) {
            kode = kandidat;
            unique = true;
          }
          attempts++;
        }
        if (!unique) return jawab({ pesan: "gagal membuat kode unik" }, 500, asal);
        const kini = (/* @__PURE__ */ new Date()).toISOString();
        await env.DB.prepare("INSERT INTO referral_kode (pengguna, kode, dibuat) VALUES (?, ?, ?)").bind(saya.id, kode, kini).run();
        return jawab({ kode }, 200, asal);
      }
      if (jalan === "/api/referral/track" && request.method === "POST") {
        const ip = request.headers.get("CF-Connecting-IP") || "tanpa-ip";
        const laju = await batasiLaju(env, ip, "ref_track", 30, 60);
        if (!laju.boleh) return jawab({ pesan: "terlalu sering" }, 429, asal);
        const b = await request.json().catch(() => ({}));
        const kodeRef = String(b.ref || "").toUpperCase().trim();
        if (!kodeRef || !/^SPRF[A-Z0-9]{8}$/.test(kodeRef)) {
          return jawab({ ok: true, tracked: false }, 200, asal);
        }
        const ref = await env.DB.prepare("SELECT pengguna FROM referral_kode WHERE kode = ?").bind(kodeRef).first();
        if (!ref) {
          return jawab({ ok: true, tracked: false }, 200, asal);
        }
        const utmSource = String(b.utm_source || "").slice(0, 50);
        const utmMedium = String(b.utm_medium || "").slice(0, 50);
        const utmCampaign = String(b.utm_campaign || "").slice(0, 100);
        const kini = (/* @__PURE__ */ new Date()).toISOString();
        await env.DB.prepare(
          "INSERT INTO referral_konversi (kode_ref, waktu, status, utm_source, utm_medium, utm_campaign) VALUES (?, ?, ?, ?, ?, ?)"
        ).bind(kodeRef, kini, "visit", utmSource, utmMedium, utmCampaign).run();
        return jawab({ ok: true, tracked: true }, 200, asal);
      }
      if (jalan === "/api/referral/konversi" && request.method === "POST") {
        const ip = request.headers.get("CF-Connecting-IP") || "tanpa-ip";
        const laju = await batasiLaju(env, ip, "ref_conv", 20, 60);
        if (!laju.boleh) return jawab({ pesan: "terlalu sering" }, 429, asal);
        const b = await request.json().catch(() => ({}));
        const kodeRef = String(b.ref || "").toUpperCase().trim();
        const rujukanBeli = String(b.rujukan || "").trim().slice(0, 20);
        const nominal = Math.round(Number(b.nominal)) || 39e3;
        if (!kodeRef || !/^SPRF[A-Z0-9]{8}$/.test(kodeRef)) {
          return jawab({ pesan: "kode referral tidak sah" }, 400, asal);
        }
        const ref = await env.DB.prepare("SELECT pengguna FROM referral_kode WHERE kode = ?").bind(kodeRef).first();
        if (!ref) {
          return jawab({ pesan: "kode referral tidak ditemukan" }, 400, asal);
        }
        if (rujukanBeli) {
          const existing = await env.DB.prepare("SELECT 1 FROM referral_konversi WHERE kode_ref = ? AND rujukan_beli = ? AND status != ?").bind(kodeRef, rujukanBeli, "visit").first();
          if (existing) {
            return jawab({ ok: true, duplicate: true }, 200, asal);
          }
        }
        const utmSource = String(b.utm_source || "").slice(0, 50);
        const utmMedium = String(b.utm_medium || "").slice(0, 50);
        const utmCampaign = String(b.utm_campaign || "").slice(0, 100);
        const kini = (/* @__PURE__ */ new Date()).toISOString();
        await env.DB.prepare(
          "INSERT INTO referral_konversi (kode_ref, rujukan_beli, nominal, waktu, status, utm_source, utm_medium, utm_campaign) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        ).bind(kodeRef, rujukanBeli || null, nominal, kini, "paid", utmSource, utmMedium, utmCampaign).run();
        const komisi = Math.round(nominal * 0.1);
        await env.DB.prepare(
          "INSERT INTO referral_kredit (pengguna, total, diperbarui) VALUES (?, ?, ?) ON CONFLICT(pengguna) DO UPDATE SET total = referral_kredit.total + excluded.total, diperbarui = excluded.diperbarui"
        ).bind(ref.pengguna, komisi, kini).run();
        await env.DB.prepare("INSERT INTO peristiwa (pengguna, jenis, rincian, waktu) VALUES (?, ?, ?, ?)").bind(ref.pengguna, "referral_komisi", kodeRef + "|" + komisi + "|" + (rujukanBeli || ""), kini).run();
        return jawab({ ok: true, komisi, referrer: ref.pengguna }, 200, asal);
      }
      if (jalan === "/api/referral/stats" && request.method === "GET") {
        if (!saya) return perluMasuk();
        const [kodeRow, visits, conversions, kredit] = await Promise.all([
          env.DB.prepare("SELECT kode FROM referral_kode WHERE pengguna = ?").bind(saya.id).first(),
          env.DB.prepare("SELECT COUNT(*) AS n FROM referral_konversi WHERE kode_ref = (SELECT kode FROM referral_kode WHERE pengguna = ?) AND status = ?").bind(saya.id, "visit").first(),
          env.DB.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(nominal),0) AS total_nominal FROM referral_konversi WHERE kode_ref = (SELECT kode FROM referral_kode WHERE pengguna = ?) AND status = ?").bind(saya.id, "paid").first(),
          env.DB.prepare("SELECT total FROM referral_kredit WHERE pengguna = ?").bind(saya.id).first()
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
      if (jalan === "/api/pemilik/referral" && request.method === "GET") {
        if (!saya) return perluMasuk();
        if (!adalahPemilik(saya)) return jawab({ pesan: "bukan pemilik" }, 403, asal);
        const u = new URL(request.url);
        const limit = Math.min(200, Math.max(1, parseInt(u.searchParams.get("limit") || "100", 10)));
        const offset = Math.max(0, parseInt(u.searchParams.get("offset") || "0", 10));
        const [kodeList, konversiList, kreditList] = await Promise.all([
          env.DB.prepare("SELECT rk.kode, rk.pengguna, rk.dibuat, p.surel, p.nama FROM referral_kode rk LEFT JOIN pengguna p ON rk.pengguna = p.id ORDER BY rk.dibuat DESC LIMIT ? OFFSET ?").bind(limit, offset).all(),
          env.DB.prepare('SELECT kode_ref, COUNT(*) AS kunjungan, SUM(CASE WHEN status = "paid" THEN 1 ELSE 0 END) AS konversi, SUM(CASE WHEN status = "paid" THEN nominal ELSE 0 END) AS total_nominal FROM referral_konversi GROUP BY kode_ref ORDER BY konversi DESC').all(),
          env.DB.prepare("SELECT pengguna, total FROM referral_kredit ORDER BY total DESC").all()
        ]);
        const konversiMap = {};
        konversiList.results?.forEach((r) => {
          konversiMap[r.kode_ref] = r;
        });
        const kreditMap = {};
        kreditList.results?.forEach((r) => {
          kreditMap[r.pengguna] = r.total;
        });
        const referral = (kodeList.results || []).map((r) => ({
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
      if (jalan === "/premium" && request.method === "GET") {
        if (!saya) return jawab({ premium: false }, 401, asal);
        const has = await env.DB.prepare("SELECT 1 FROM pembelian WHERE pengguna = ? LIMIT 1").bind(saya.id).first();
        return jawab({ premium: !!has }, 200, asal);
      }
      if (jalan === "/api/monitoring/status" && request.method === "GET") {
        const u = new URL(request.url);
        const limit = Math.min(50, Math.max(1, parseInt(u.searchParams.get("limit") || "10", 10)));
        const rows = await env.DB.prepare(
          "SELECT waktu, endpoint, status, ok_qris, ok_turnstile, ok_cta, latency_ms, rincian, alert_terkirim FROM monitoring_checks ORDER BY waktu DESC LIMIT ?"
        ).bind(limit).all();
        return jawab({ checks: rows.results || [] }, 200, asal);
      }
      if (jalan === "/api/monitoring/status-full" && request.method === "GET") {
        const hasil = await cekMonitoringLengkap(env);
        return jawab({ ok: hasil.ok, waktu: (/* @__PURE__ */ new Date()).toISOString(), beli: hasil.beli, funnel: hasil.funnel, tripay: hasil.tripay, rincian: hasil.rincian }, 200, asal);
      }
      if (jalan === "/api/monitoring/test" && request.method === "POST") {
        const hasil = await cekMonitoringLengkap(env);
        return jawab({ ok: hasil.ok, rincian: hasil.rincian, beli: hasil.beli, funnel: hasil.funnel, tripay: hasil.tripay }, 200, asal);
      }
      return jawab({ pesan: "alamat tidak dikenal" }, 404, asal);
    } catch (e) {
      return jawab({ pesan: "permintaan tidak bisa diproses", rincian: String(e.message || e).slice(0, 160) }, 400, asal);
    }
  },
  async scheduled(event, env, ctx) {
    if (event.cron === "55 16 * * *") {
      await laporanHarian(env);
      return;
    }
    const kini = /* @__PURE__ */ new Date();
    if (kini.getUTCHours() % 6 === 0 && kini.getUTCMinutes() <= 10) await simpanSnapshotFunnel(env);
    await cekMonitoringLengkap(env);
  }
};
var MONITOR_ENDPOINT = "https://siappsikotes.my.id/beli/";
var TRIPAY_WEBHOOK_URL = "";
var TG_BOT_TOKEN = "8649638758:***";
var TG_CHAT_ID = "7809584261";
async function kirimTelegramAlert(env, pesan) {
  const token = env.TG_BOT_TOKEN || TG_BOT_TOKEN;
  const chatId = env.TG_CHAT_ID || TG_CHAT_ID;
  if (!token || token === TG_BOT_TOKEN) return { ok: false, reason: "token tidak dikonfigurasi" };
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: pesan, parse_mode: "HTML" })
    });
    return { ok: r.ok, status: r.status };
  } catch (e) {
    return { ok: false, reason: String(e.message || e).slice(0, 100) };
  }
}
__name(kirimTelegramAlert, "kirimTelegramAlert");
async function cekFunnelCSV(env) {
  try {
    const cutoff = new Date(Date.now() - 2 * 864e5).toISOString();
    const rows = await env.DB.prepare("SELECT waktu, jenis, rincian FROM peristiwa WHERE waktu >= ? ORDER BY waktu DESC LIMIT 100").bind(cutoff).all();
    const data = rows.results || [];
    if (!data.length) return { ok: false, status: 200, rincian: "Funnel data kosong" };
    const terbaru = new Date(data[0].waktu);
    const sekarang = /* @__PURE__ */ new Date();
    const jamLalu = (sekarang - terbaru) / (1e3 * 60 * 60);
    if (jamLalu > 28) return { ok: false, status: 200, rincian: "Funnel data usang " + jamLalu.toFixed(1) + " jam" };
    return { ok: true, status: 200, rincian: "OK (data " + jamLalu.toFixed(1) + " jam lalu)", jumlah: data.length };
  } catch (e) {
    return { ok: false, status: 0, rincian: "Funnel error: " + String(e.message || e).slice(0, 100) };
  }
}
__name(cekFunnelCSV, "cekFunnelCSV");
async function laporanHarian(env) {
  try {
    const sejak = new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10);
    const [pe, pay] = await Promise.all([
      env.DB.prepare(
        "SELECT substr(waktu,1,10) AS hari, COUNT(DISTINCT CASE WHEN jenis = 'beli:kunjungan_beli' THEN rincian END) AS kunjungan, COUNT(DISTINCT CASE WHEN jenis = 'beli:klik_cta_bayar' THEN rincian END) AS klik FROM peristiwa WHERE jenis LIKE 'beli:%' AND substr(waktu,1,10) >= ? GROUP BY substr(waktu,1,10)"
      ).bind(sejak).all(),
      env.DB.prepare(
        "SELECT substr(timestamp,1,10) AS hari, COUNT(*) AS bayar, COALESCE(SUM(amount),0) AS revenue FROM payments WHERE status IN ('success','paid') AND is_test = 0 AND substr(timestamp,1,10) >= ? GROUP BY substr(timestamp,1,10)"
      ).bind(sejak).all()
    ]);
    const mapHari = {};
    for (const r of pe.results || []) {
      mapHari[r.hari] = { kunjungan: r.kunjungan || 0, klik: r.klik || 0, bayar: 0, revenue: 0 };
    }
    for (const r of pay.results || []) {
      if (!mapHari[r.hari]) mapHari[r.hari] = { kunjungan: 0, klik: 0, bayar: 0, revenue: 0 };
      mapHari[r.hari].bayar = r.bayar || 0;
      mapHari[r.hari].revenue = r.revenue || 0;
    }
    const daftar = Object.keys(mapHari).sort().reverse();
    let totalV = 0, totalK = 0, totalB = 0, rev = 0;
    const baris = daftar.map((h) => {
      const d = mapHari[h];
      totalV += d.kunjungan;
      totalK += d.klik;
      totalB += d.bayar;
      rev += d.revenue;
      const conv = d.kunjungan ? (d.bayar / d.kunjungan * 100).toFixed(1) + "%" : "-";
      return h + " \xB7 kunjungan " + d.kunjungan + " \xB7 klik " + d.klik + " \xB7 bayar " + d.bayar + " \xB7 " + conv + " \xB7 Rp " + Number(d.revenue).toLocaleString("id-ID");
    }).join("\n");
    const convTotal = totalV ? (totalB / totalV * 100).toFixed(1) + "%" : "-";
    let rekonsiliasi = 'Klaim "sudah bayar": tidak ada dalam 7 hari.';
    try {
      const [klaim, masuk] = await Promise.all([
        env.DB.prepare("SELECT rujukan, nominal, dibayar FROM kode_terbit WHERE asal = 'klaim' AND dibayar IS NOT NULL AND dibayar >= ? ORDER BY dibayar DESC LIMIT 100").bind(sejak).all(),
        env.DB.prepare("SELECT DISTINCT rujukan FROM payments WHERE status IN ('success','paid') AND is_test = 0 AND rujukan IS NOT NULL AND timestamp >= ?").bind(sejak).all()
      ]);
      const sah = new Set((masuk.results || []).map((r) => r.rujukan));
      const belum = (klaim.results || []).filter((k) => !sah.has(k.rujukan));
      if ((klaim.results || []).length) {
        rekonsiliasi = belum.length === 0 ? 'Klaim "sudah bayar": ' + klaim.results.length + " \u2014 semua terkonfirmasi pembayaran masuk \u2713" : "\u26A0\uFE0F Klaim TANPA pembayaran tercatat (rekonsiliasi manual):\n" + belum.map((k) => "\u2022 " + k.rujukan + " \u2014 Rp " + Number(k.nominal).toLocaleString("id-ID") + " (klaim " + String(k.dibayar).slice(0, 16).replace("T", " ") + " UTC)").join("\n");
      }
    } catch (e) {
      rekonsiliasi = "Rekonsiliasi gagal dihitung: " + String(e.message || e).slice(0, 80);
    }
    const pesan = `<b>\u{1F4CA} Funnel /beli/ \u2014 7 hari terakhir</b>
` + (baris || "(belum ada data)") + `

Total: kunjungan ${totalV} \xB7 klik ${totalK} \xB7 bayar ${totalB} \xB7 konversi ${convTotal} \xB7 Rp ${Number(rev).toLocaleString("id-ID")}

<b>\u{1F9FE} ${rekonsiliasi}</b>
CSV: https://siappsikotes-api.rasyidahmad180.workers.dev/api/dashboard/funnel-csv`;
    const tg = await kirimTelegramAlert(env, pesan);
    return { ok: !!tg.ok, tg, ringkasan: baris || "(belum ada data)" };
  } catch (e) {
    return { ok: false, ringkasan: String(e.message || e).slice(0, 160) };
  }
}
__name(laporanHarian, "laporanHarian");
async function funnelHarianJson(env) {
  const jumlahHari = 7;
  const hariIni = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const daftarHari = [];
  for (let i = 0; i < jumlahHari; i++) {
    daftarHari.push(new Date(Date.now() - (jumlahHari - 1 - i) * 864e5).toISOString().slice(0, 10));
  }
  const awal = daftarHari[0];
  const [pe, pay] = await Promise.all([
    env.DB.prepare(
      "SELECT substr(waktu,1,10) AS hari, COUNT(DISTINCT CASE WHEN jenis = 'beli:kunjungan_beli' THEN rincian END) AS kunjungan, COUNT(DISTINCT CASE WHEN jenis = 'beli:klik_cta_bayar' THEN rincian END) AS klik, COUNT(DISTINCT CASE WHEN jenis = 'beli:qris_tampil' THEN rincian END) AS qris FROM peristiwa WHERE jenis IN ('beli:kunjungan_beli','beli:klik_cta_bayar','beli:qris_tampil') AND substr(waktu,1,10) >= ? GROUP BY substr(waktu,1,10)"
    ).bind(awal).all(),
    env.DB.prepare(
      "SELECT substr(timestamp,1,10) AS hari, COUNT(*) AS bayar, COALESCE(SUM(amount),0) AS revenue FROM payments WHERE status IN ('success','paid') AND is_test = 0 AND substr(timestamp,1,10) >= ? GROUP BY substr(timestamp,1,10)"
    ).bind(awal).all()
  ]);
  const mapHari = {};
  for (const r of pe.results || []) {
    mapHari[r.hari] = { kunjungan: r.kunjungan || 0, klik: r.klik || 0, qris: r.qris || 0, bayar: 0, revenue: 0 };
  }
  for (const r of pay.results || []) {
    if (!mapHari[r.hari]) mapHari[r.hari] = { kunjungan: 0, klik: 0, qris: 0, bayar: 0, revenue: 0 };
    mapHari[r.hari].bayar = r.bayar || 0;
    mapHari[r.hari].revenue = r.revenue || 0;
  }
  const bentuk = /* @__PURE__ */ __name((h) => {
    const d = mapHari[h] || { kunjungan: 0, klik: 0, qris: 0, bayar: 0, revenue: 0 };
    return {
      hari: h,
      kunjungan: d.kunjungan,
      klik_bayar: d.klik,
      qris_dibuat: d.qris,
      bayar_konfirmasi: d.bayar,
      cart_abandon: Math.max(0, d.klik - d.bayar),
      revenue_rp: d.revenue,
      konversi_pct: d.kunjungan ? Math.round(d.bayar / d.kunjungan * 1e4) / 100 : 0
    };
  }, "bentuk");
  const harian = daftarHari.map(bentuk);
  const total = harian.reduce((a, b) => ({
    kunjungan: a.kunjungan + b.kunjungan,
    klik_bayar: a.klik_bayar + b.klik_bayar,
    qris_dibuat: a.qris_dibuat + b.qris_dibuat,
    bayar_konfirmasi: a.bayar_konfirmasi + b.bayar_konfirmasi,
    revenue_rp: a.revenue_rp + b.revenue_rp
  }), { kunjungan: 0, klik_bayar: 0, qris_dibuat: 0, bayar_konfirmasi: 0, revenue_rp: 0 });
  total.cart_abandon = Math.max(0, total.klik_bayar - total.bayar_konfirmasi);
  total.konversi_pct = total.kunjungan ? Math.round(total.bayar_konfirmasi / total.kunjungan * 1e4) / 100 : 0;
  return {
    aplikasi: "SiapPsikotes",
    judul: "Funnel harian /beli/",
    waktu_snapshot: (/* @__PURE__ */ new Date()).toISOString(),
    zona_hari: "UTC",
    cron_snapshot: "0 */6 * * * (tiap 6 jam)",
    definisi: {
      kunjungan: "pengunjung unik /beli/ (rujukan SP-xxx, event kunjungan_beli)",
      klik_bayar: "klik unik tombol CTA bayar",
      qris_dibuat: "QRIS tampil unik",
      bayar_konfirmasi: "webhook pembayaran status success/paid (Tripay/QRIS)",
      cart_abandon: "klik_bayar tanpa bayar_konfirmasi (min. 0)",
      konversi_pct: "bayar_konfirmasi / kunjungan * 100"
    },
    hari_ini: bentuk(hariIni),
    total_7_hari: total,
    "7_hari": harian
  };
}
__name(funnelHarianJson, "funnelHarianJson");
async function simpanSnapshotFunnel(env) {
  try {
    const data = await funnelHarianJson(env);
    data.sumber = "snapshot-kv";
    await env.FUNNEL_KV.put("funnel:terkini", JSON.stringify(data));
    return { ok: true, waktu: data.waktu_snapshot, hari_ini: data.hari_ini };
  } catch (e) {
    return { ok: false, pesan: String(e.message || e).slice(0, 160) };
  }
}
__name(simpanSnapshotFunnel, "simpanSnapshotFunnel");
async function cekTripayWebhook() {
  if (!TRIPAY_WEBHOOK_URL) return { ok: true, status: 0, rincian: "Tripay tidak dikonfigurasi (static QRIS manual)" };
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1e4);
    const resp = await fetch(TRIPAY_WEBHOOK_URL + "/health", {
      method: "GET",
      signal: controller.signal
    });
    clearTimeout(timeout);
    return { ok: resp.ok, status: resp.status, rincian: resp.ok ? "OK" : "HTTP " + resp.status };
  } catch (e) {
    return { ok: false, status: 0, rincian: "Tripay error: " + String(e.message || e).slice(0, 100) };
  }
}
__name(cekTripayWebhook, "cekTripayWebhook");
async function cekBeliPage(env) {
  const mulai = Date.now();
  let status = 0;
  let okQris = 0;
  let okTurnstile = 0;
  let okCta = 0;
  let rincian = "";
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15e3);
    const resp = await fetch(MONITOR_ENDPOINT, {
      method: "GET",
      headers: { "User-Agent": "SiapPsikotes-Monitor/1.0" },
      signal: controller.signal,
      cf: { cacheTtl: 0, cacheEverything: false }
    });
    clearTimeout(timeout);
    status = resp.status;
    const html = await resp.text();
    const latency = Date.now() - mulai;
    const adaQris = /qris-bayar\.png/i.test(html) || /id=["']qris["']/i.test(html) || /\bQRIS\b/i.test(html);
    const adaTurnstile = /cf-chl|turnstile|challenge-platform|__cf_chl/i.test(html);
    const adaCta = /id=["']ctaBayar["']/i.test(html);
    okQris = adaQris ? 1 : 0;
    okTurnstile = adaTurnstile ? 0 : 1;
    okCta = adaCta ? 1 : 0;
    const parts = [];
    if (!adaQris) parts.push("QRIS hilang");
    if (adaTurnstile) parts.push("Turnstile terdeteksi");
    if (!adaCta) parts.push("CTA hilang");
    rincian = parts.length ? parts.join(", ") : "OK";
    await env.DB.prepare(
      "INSERT INTO monitoring_checks (waktu, endpoint, status, ok_qris, ok_turnstile, ok_cta, latency_ms, rincian, alert_terkirim) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)"
    ).bind((/* @__PURE__ */ new Date()).toISOString(), MONITOR_ENDPOINT, status, okQris, okTurnstile, okCta, latency, rincian).run();
    const sehat = status === 200 && okQris && okTurnstile && okCta;
    if (!sehat) {
      const alertMsg = `\u26A0\uFE0F <b>Monitoring /beli/ GAGAL</b>
Waktu: ${(/* @__PURE__ */ new Date()).toISOString()}
Status HTTP: ${status}
QRIS: ${okQris ? "\u2705" : "\u274C"}
Turnstile: ${okTurnstile ? "\u2705 (tidak ada)" : "\u274C (terdeteksi)"}
CTA: ${okCta ? "\u2705" : "\u274C"}
Latency: ${latency}ms
Rincian: ${rincian}`;
      const alertResult = await kirimTelegramAlert(env, alertMsg);
      await env.DB.prepare(
        "UPDATE monitoring_checks SET alert_terkirim = 1 WHERE waktu = (SELECT MAX(waktu) FROM monitoring_checks WHERE endpoint = ?)"
      ).bind(MONITOR_ENDPOINT).run();
      return { ok: false, status, okQris, okTurnstile, okCta, latency, rincian, alert: alertResult };
    }
    return { ok: true, status, okQris, okTurnstile, okCta, latency, rincian };
  } catch (e) {
    const latency = Date.now() - mulai;
    const errMsg = String(e.message || e).slice(0, 160);
    await env.DB.prepare(
      "INSERT INTO monitoring_checks (waktu, endpoint, status, ok_qris, ok_turnstile, ok_cta, latency_ms, rincian, alert_terkirim) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)"
    ).bind((/* @__PURE__ */ new Date()).toISOString(), MONITOR_ENDPOINT, 0, 0, 0, 0, latency, "Fetch error: " + errMsg).run();
    const alertMsg = `\u{1F6A8} <b>Monitoring /beli/ ERROR</b>
Waktu: ${(/* @__PURE__ */ new Date()).toISOString()}
Error: ${errMsg}`;
    const alertResult = await kirimTelegramAlert(env, alertMsg);
    await env.DB.prepare(
      "UPDATE monitoring_checks SET alert_terkirim = 1 WHERE waktu = (SELECT MAX(waktu) FROM monitoring_checks WHERE endpoint = ?)"
    ).bind(MONITOR_ENDPOINT).run();
    return { ok: false, status: 0, okQris: 0, okTurnstile: 0, okCta: 0, latency, rincian: errMsg, alert: alertResult };
  }
}
__name(cekBeliPage, "cekBeliPage");
async function cekMonitoringLengkap(env) {
  const [beli, funnel, tripay] = await Promise.all([
    cekBeliPage(env),
    cekFunnelCSV(env),
    cekTripayWebhook()
  ]);
  const semuaSehat = beli.ok && funnel.ok && tripay.ok;
  const rincianGabungan = [
    "beli: " + (beli.ok ? "OK" : "GAGAL - " + beli.rincian),
    "funnel: " + (funnel.ok ? "OK" : "GAGAL - " + funnel.rincian),
    "tripay: " + (tripay.ok ? "OK" : "GAGAL - " + tripay.rincian)
  ].join("; ");
  if (!semuaSehat) {
    const alertMsg = `\u{1F6A8} <b>Monitoring Komprehensif GAGAL</b>
Waktu: ${(/* @__PURE__ */ new Date()).toISOString()}
Rincian: ${rincianGabungan}`;
    await kirimTelegramAlert(env, alertMsg);
  }
  return { ok: semuaSehat, beli, funnel, tripay, rincian: rincianGabungan };
}
__name(cekMonitoringLengkap, "cekMonitoringLengkap");

// ../../.local/lib/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../.local/lib/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-pwEe0V/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// ../../.local/lib/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-pwEe0V/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map

-- Skema database SiapPsikotes (Cloudflare D1 / SQLite)
-- Setiap pengguna hanya bisa membaca & menulis barisnya sendiri.
-- Tidak ada API tabel otomatis: semua akses lewat kode Worker yang memeriksa sesi dulu.

CREATE TABLE IF NOT EXISTS pengguna (
  id            TEXT PRIMARY KEY,              -- sub Google (unik, tidak berubah)
  surel         TEXT NOT NULL,
  nama          TEXT,
  foto          TEXT,
  jalur         TEXT,
  target_tanggal TEXT,
  dibuat        TEXT NOT NULL,
  terakhir_aktif TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pengguna_terakhir ON pengguna(terakhir_aktif);

-- Sesi: yang disimpan adalah HASH token, bukan tokennya. Bocornya database tidak
-- langsung memberi akses masuk.
CREATE TABLE IF NOT EXISTS sesi (
  token_hash TEXT PRIMARY KEY,
  pengguna   TEXT NOT NULL,
  dibuat     TEXT NOT NULL,
  kedaluwarsa TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sesi_pengguna ON sesi(pengguna);

-- Progres per kategori (dipakai untuk melanjutkan belajar di perangkat lain)
CREATE TABLE IF NOT EXISTS progres (
  pengguna  TEXT NOT NULL,
  kategori  TEXT NOT NULL,
  benar     INTEGER NOT NULL DEFAULT 0,
  salah     INTEGER NOT NULL DEFAULT 0,
  terakhir  TEXT NOT NULL,
  PRIMARY KEY (pengguna, kategori)
);

-- Soal yang perlu diulang
CREATE TABLE IF NOT EXISTS salah (
  pengguna TEXT NOT NULL,
  id_soal  TEXT NOT NULL,
  kategori TEXT,
  jumlah   INTEGER NOT NULL DEFAULT 1,
  terakhir TEXT NOT NULL,
  PRIMARY KEY (pengguna, id_soal)
);

-- Bahan belajar lain (catatan wawancara, kartu hafalan, hasil tes, dll.)
CREATE TABLE IF NOT EXISTS bahan (
  pengguna  TEXT NOT NULL,
  jenis     TEXT NOT NULL,
  kunci     TEXT NOT NULL,
  isi       TEXT,
  diperbarui TEXT NOT NULL,
  PRIMARY KEY (pengguna, jenis, kunci)
);

-- Pembelian / kode akses: supaya kode yang dibeli tidak hilang saat ganti perangkat
CREATE TABLE IF NOT EXISTS pembelian (
  pengguna TEXT NOT NULL,
  kode     TEXT NOT NULL,
  rujukan  TEXT,
  nominal  INTEGER,
  tanggal  TEXT NOT NULL,
  PRIMARY KEY (pengguna, kode)
);

-- Kode akses yang SAH terbit. Kode yang tidak ada di sini DITOLAK di /api/ruang/masuk.
-- Alasannya: sidik 4 huruf pada kode dihitung dari kunci yang ikut terkirim ke peramban
-- (tools/buat-kode.py, static/js/fitur11.js), jadi siapa pun bisa membuat kode ber-sidik
-- benar tanpa membayar. Baris di tabel ini hanya lahir dari jalur pemilik SETELAH setoran
-- dicatat (lihat tools/terbitkan-kode.py dan /api/pemilik/kode-terbit), dan hanya baris
-- inilah yang membuat sebuah kode berlaku.
-- Yang disimpan adalah HASH kode (sama seperti sesi), bukan kodenya: bocornya database
-- tidak memberi kode yang bisa dipakai orang lain.
CREATE TABLE IF NOT EXISTS kode_terbit (
  kode_hash TEXT PRIMARY KEY,          -- SHA-256 dari penanda 'kodet:' + kode lengkap
  kode_akhir TEXT,                     -- 6 karakter terakhir, untuk dikenali pemilik
  terbit    TEXT NOT NULL,             -- waktu kode diterbitkan
  dibayar   TEXT,                      -- waktu setoran dicatat (NULL = pesanan menunggu_bayar)
  rujukan   TEXT,                      -- rujukan setoran (nomor transfer / SP-594)
  nominal   INTEGER NOT NULL DEFAULT 0,-- nominal setoran menurut catatan server
  asal      TEXT                       -- 'alat-pemilik' = terbit manual pemilik (langsung lunas);
                                       -- 'menunggu-bayar' = pesanan pembeli (belum bayar);
                                       -- 'klaim' = klaim "sudah bayar" HMAC (menunggu verifikasi harian);
                                       -- 'tripay' = webhook Tripay PAID (lunas otomatis, terverifikasi)
  kontak     TEXT,                   -- WA/email klaimer (opsional, klaim pertama, disanitasi)
);
CREATE INDEX IF NOT EXISTS idx_kode_terbit_dibayar ON kode_terbit(dibayar);

-- Catatan pembayaran dari webhook. is_test = 1 untuk data uji/audit/probe: SEMUA metrik
-- revenue (dashboard stats, funnel CSV, laporan harian) hanya menjumlah is_test = 0.
CREATE TABLE IF NOT EXISTS payments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp  TEXT NOT NULL,
  utm_source TEXT,
  utm_medium TEXT,
  product    TEXT,
  amount     INTEGER,
  status     TEXT,
  txid       TEXT,
  raw_payload TEXT,
  is_test    INTEGER NOT NULL DEFAULT 0,
  rujukan    TEXT                      -- rujukan pesanan SP-xxx (webhook Tripay), untuk rekonsiliasi klaim
);
CREATE INDEX IF NOT EXISTS idx_payments_timestamp ON payments(timestamp);

-- Catatan ringkas untuk dasbor pemilik
CREATE TABLE IF NOT EXISTS peristiwa (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  pengguna TEXT,
  jenis    TEXT NOT NULL,
  rincian  TEXT,
  waktu    TEXT NOT NULL,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  is_test  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_peristiwa_waktu ON peristiwa(waktu);

-- Pembatas laju (rate limit). Baris lama dibersihkan berkala oleh Worker.
CREATE TABLE IF NOT EXISTS batas (
  kunci  TEXT PRIMARY KEY,
  jumlah INTEGER NOT NULL DEFAULT 0
);

-- Monitoring /beli/ health checks (Cron Trigger tiap 10 menit)
CREATE TABLE IF NOT EXISTS monitoring_checks (
  waktu       TEXT NOT NULL,
  endpoint    TEXT NOT NULL,
  status      INTEGER NOT NULL,
  ok_qris     INTEGER NOT NULL,
  ok_turnstile INTEGER NOT NULL,
  ok_cta      INTEGER NOT NULL,
  latency_ms  INTEGER NOT NULL,
  rincian     TEXT,
  alert_terkirim INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_monitoring_waktu ON monitoring_checks(waktu);
CREATE INDEX IF NOT EXISTS idx_monitoring_endpoint ON monitoring_checks(endpoint);
-- Migrasi program referensi SiapPsikotes (t_34c033b4, keputusan FINAL marketing).
-- Mekanisme: 1 pembeli 1 kode REF-XXXX otomatis saat pembayaran sukses; teman yang
-- beli lewat kode dapat diskon Rp 5.000 (Rp 34.000); referrer dapat +30 hari akses,
-- maksimal 10 klaim/bulan/kode.
--
-- Tabel lama (mekanisme SPRF berbasis login yang tidak pernah dipakai) kosong
-- 0 baris — diverifikasi langsung di D1 produksi 19 Okt 2026 — sehingga aman
-- dibangun ulang mengikuti skema FINAL.

DROP TABLE IF EXISTS referral_kredit;
DROP TABLE IF EXISTS referral_kode;
DROP TABLE IF EXISTS referral_konversi;

-- Satu kode per pembayaran sukses. payment_id = rujukan pesanan pembeli asal (SP-xxx).
CREATE TABLE referral_kode (
  kode            TEXT PRIMARY KEY,             -- 'REF-XXXX' (4 karakter alfanumerik)
  payment_id      TEXT,                         -- rujukan pesanan asal kode
  dibuat_at       TEXT NOT NULL,
  klaim_bulan_ini INTEGER NOT NULL DEFAULT 0,   -- reward yang diberikan bulan berjalan (maks 10)
  klaim_bulan     TEXT,                         -- 'YYYY-MM' yang dihitung klaim_bulan_ini
  reward_hari     INTEGER NOT NULL DEFAULT 0    -- total hari akses tambahan yang sudah diraih
);

-- Jejak penggunaan kode: 'checkout' = diskon dipakai saat pesanan dibuat;
-- 'reward' = pembayaran sukses lewat kode, referrer diberi +30 hari.
CREATE TABLE referral_konversi (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  kode            TEXT NOT NULL,
  pembayaran_baru TEXT,                         -- rujukan pesanan baru (SP-xxx)
  waktu           TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'checkout',
  nominal         INTEGER,
  utm_source      TEXT,
  utm_medium      TEXT,
  utm_campaign    TEXT
);
CREATE INDEX IF NOT EXISTS idx_refkon_kode ON referral_konversi(kode);

-- kode_terbit: ref yang dipakai saat checkout + batas akses (untuk reward referrer).
ALTER TABLE kode_terbit ADD COLUMN ref_kode TEXT;     -- REF-XXXX yang dipakai pembeli (NULL = tanpa ref)
ALTER TABLE kode_terbit ADD COLUMN akses_hingga TEXT; -- akses berakhir pada (NULL = tanpa batas; pembeli saat ini tidak diberi batas)

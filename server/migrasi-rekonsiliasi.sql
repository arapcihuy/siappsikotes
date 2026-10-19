-- Migrasi task rekonsiliasi pembayaran: kontak klaimer pada baris kode_terbit.
-- Jalankan: npx wrangler d1 execute siappsikotes-db --remote --file=migrasi-rekonsiliasi.sql --config=wrangler.toml
-- Bila kolom kontak sudah ada, baris ALTER akan ditolak SQLite (duplicate column)
-- tanpa mengubah apa pun — jalankan PRAGMA table_info dulu untuk mengecek.
PRAGMA table_info(kode_terbit);
ALTER TABLE kode_terbit ADD COLUMN kontak TEXT;
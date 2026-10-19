-- Migration: tambahkan kolom is_test ke tabel peristiwa
ALTER TABLE peristiwa ADD COLUMN is_test INTEGER NOT NULL DEFAULT 0;

-- Backfill: set is_test=1 untuk baris dengan utm_source menandakan test
UPDATE peristiwa SET is_test = 1
WHERE lower(utm_source) LIKE 'uji-%' OR lower(utm_source) LIKE 'probe%'
   OR lower(utm_source) LIKE 'audit%'
   OR lower(utm_source) LIKE 'verify-task%'
   OR lower(utm_source) LIKE 'test%';

-- Contoh backfill tambahan untuk rincian spesifik (opsional)
UPDATE peristiwa SET is_test = 1 WHERE rincian LIKE 'SP-777|var:b%';
UPDATE peristiwa SET is_test = 1 WHERE rincian LIKE 'SP-123%';
UPDATE peristiwa SET is_test = 1 WHERE rincian LIKE 'SP-532%';
UPDATE peristiwa SET is_test = 1 WHERE rincian LIKE 'SP-001%';
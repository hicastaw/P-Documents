-- =====================================================
-- MIGRATION 003: Full-text search có index + tiếng Việt không dấu
-- Trước đây to_tsvector() được tính on-the-fly mỗi lần search, không có
-- index nào hỗ trợ — chậm hẳn khi corpus lớn. Thêm GIN index + cấu hình
-- text-search riêng (vi_unaccent) để tìm không phân biệt dấu tiếng Việt.
-- =====================================================

CREATE EXTENSION IF NOT EXISTS unaccent;

DO $$
BEGIN
  CREATE TEXT SEARCH CONFIGURATION vi_unaccent (COPY = simple);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TEXT SEARCH CONFIGURATION vi_unaccent
  ALTER MAPPING FOR hword, hword_part, word WITH unaccent, simple;

CREATE INDEX IF NOT EXISTS idx_documents_fulltext
  ON documents USING gin(to_tsvector('vi_unaccent', title || ' ' || coalesce(description, '')));

CREATE INDEX IF NOT EXISTS idx_doc_chunks_fulltext
  ON doc_chunks USING gin(to_tsvector('vi_unaccent', content));

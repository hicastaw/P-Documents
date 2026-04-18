-- =====================================================
-- MIGRATION 002: AI Vector Search + Stars/Downloads
-- Provider: FPT AI Marketplace
-- Embedding Model: FPT.AI-e5-large (1024 chiều)
-- =====================================================

-- 1. Bật extension pgvector (vector search engine)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Thêm cột stars và downloads vào bảng documents
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS stars     int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS downloads int NOT NULL DEFAULT 0;

-- 3. Tạo bảng lưu ai đã star tài liệu nào (giống GitHub Stars)
--    Dùng để: (a) tránh star 2 lần, (b) toggle star on/off
CREATE TABLE IF NOT EXISTS document_stars (
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, document_id)
);

-- 4. Đổi cột embedding của doc_chunks từ jsonb → vector(1024)
--    (1024 chiều = kích thước của FPT.AI-e5-large / FPT.AI-gte-base)
--    Ghi chú: OpenAI text-embedding-3-small là 1536, FPT.AI-e5-large là 1024
ALTER TABLE doc_chunks DROP COLUMN IF EXISTS embedding;
ALTER TABLE doc_chunks ADD COLUMN embedding vector(1024) NULL;

-- 5. Tạo index HNSW để tìm kiếm vector cực nhanh
--    (Hierarchical Navigable Small World - thuật toán ANN tốt nhất hiện tại)
CREATE INDEX IF NOT EXISTS idx_doc_chunks_embedding
  ON doc_chunks
  USING hnsw (embedding vector_cosine_ops);

-- 6. Index hỗ trợ lọc theo document_id (khi join)
CREATE INDEX IF NOT EXISTS idx_doc_chunks_document_id
  ON doc_chunks(document_id);

-- 7. Index cho bảng stars (để query nhanh)
CREATE INDEX IF NOT EXISTS idx_document_stars_document
  ON document_stars(document_id);

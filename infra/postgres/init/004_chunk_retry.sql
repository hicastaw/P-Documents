-- =====================================================
-- MIGRATION 004: chunk_status — theo dõi riêng kết quả pipeline
-- chunking/embedding của worker (tách khỏi cột status cũ — status vẫn chỉ
-- nói lên kết quả dedup sha256, không liên quan tới việc trích xuất nội
-- dung/embedding có chạy thành công hay không).
-- =====================================================

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS chunk_status text NOT NULL DEFAULT 'pending'
    CHECK (chunk_status IN ('pending', 'completed', 'failed'));

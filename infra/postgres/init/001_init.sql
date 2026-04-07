CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  display_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS token_blacklist (
  jti text PRIMARY KEY,
  expires_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  parent_id uuid NULL REFERENCES categories(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id uuid NOT NULL REFERENCES users(id),
  category_id uuid NULL REFERENCES categories(id),
  title text NOT NULL,
  description text NULL,
  mime text NOT NULL,
  size bigint NOT NULL,
  sha256 text NULL,
  object_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'uploaded',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS documents_sha256_unique ON documents(sha256) WHERE sha256 IS NOT NULL;

CREATE TABLE IF NOT EXISTS doc_chunks (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index int NOT NULL,
  content text NOT NULL,
  embedding jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(document_id, chunk_index)
);

CREATE TABLE IF NOT EXISTS quizzes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  title text NOT NULL,
  subject text NULL,
  questions jsonb NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  quiz_id uuid NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  answers jsonb NOT NULL,
  score int NOT NULL,
  time_taken_seconds int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS forum_threads (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  title text NOT NULL,
  body text NOT NULL,
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS forum_posts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id uuid NOT NULL REFERENCES forum_threads(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body text NOT NULL,
  parent_id uuid NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_forum_posts_thread ON forum_posts(thread_id);
CREATE INDEX IF NOT EXISTS idx_forum_posts_parent ON forum_posts(parent_id);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text NULL,
  ref_id text NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read, created_at DESC);

-- Seed default categories
INSERT INTO categories (name, slug) VALUES
  ('Giáo trình', 'giao_trinh'),
  ('Bài tập', 'bai_tap'),
  ('Đề thi', 'de_thi'),
  ('Tài liệu tham khảo', 'tai_lieu_tham_khao'),
  ('Báo cáo', 'bao_cao'),
  ('Khác', 'khac')
ON CONFLICT (slug) DO NOTHING;

-- ==========================================
-- DỮ LIỆU MẪU (Dành cho việc kiểm thử)
-- ==========================================
DO $$ 
DECLARE 
    sys_user_id uuid := '00000000-0000-0000-0000-000000000001';
BEGIN
    IF NOT EXISTS (SELECT 1 FROM users WHERE id = sys_user_id) THEN
        -- 1. Tạo 1 User mẫu
        INSERT INTO users (id, email, password_hash, display_name) 
        VALUES (sys_user_id, 'system@pdocs.local', 'fake_hash', 'Hệ Thống PDOCS');
        
        -- 2. Tạo 3 Quizzes mẫu
        INSERT INTO quizzes (title, subject, questions, created_by) VALUES 
        ('Kiến thức lập trình cơ bản', 'Công nghệ', '[{"q": "HTTP là viết tắt của gì?", "options": ["HyperText Transfer Protocol", "High Tech Transfer Protocol", "Hyper Transfer Technology Protocol", "None"], "correct": "HyperText Transfer Protocol"}, {"q": "Ngôn ngữ nào được dùng để tạo trang web?", "options": ["HTML", "SQL", "Python", "Java"], "correct": "HTML"}, {"q": "CSS là gì?", "options": ["Cascading Style Sheets", "Computer Style Syntax", "Creative Style System", "None"], "correct": "Cascading Style Sheets"}]'::jsonb, sys_user_id),
        ('Lịch sử Việt Nam', 'Lịch sử', '[{"q": "Nước Cộng hòa Xã hội chủ nghĩa Việt Nam được thành lập năm nào?", "options": ["1975", "1976", "1954", "1945"], "correct": "1976"}, {"q": "Thủ đô của Việt Nam là gì?", "options": ["Hà Nội", "TP. Hồ Chí Minh", "Đà Nẵng", "Huế"], "correct": "Hà Nội"}, {"q": "Ai là Chủ tịch nước đầu tiên của Việt Nam?", "options": ["Hồ Chí Minh", "Võ Nguyên Giáp", "Lê Duẩn", "Trường Chinh"], "correct": "Hồ Chí Minh"}]'::jsonb, sys_user_id),
        ('Toán học phổ thông', 'Toán học', '[{"q": "Đạo hàm của x² là gì?", "options": ["2x", "x", "x²", "2"], "correct": "2x"}, {"q": "Tổng các góc trong một tam giác bằng bao nhiêu độ?", "options": ["180°", "360°", "90°", "270°"], "correct": "180°"}, {"q": "√144 = ?", "options": ["12", "14", "11", "13"], "correct": "12"}]'::jsonb, sys_user_id);
    END IF;
END $$;

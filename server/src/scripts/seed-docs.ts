import "dotenv/config";
import { v4 as uuidv4 } from "uuid";
import { loadEnv } from "../config/env";
import { Pool } from "pg";

const env = loadEnv();

const pool = new Pool({
  host: env.POSTGRES_HOST,
  port: env.POSTGRES_PORT,
  user: env.POSTGRES_USER,
  password: env.POSTGRES_PASSWORD,
  database: env.POSTGRES_DB,
});

const MOCK_DOCS = [
  {
    title: "Tuyệt đỉnh phân tích thiết kế hệ thống",
    description: "Tài liệu cực kỳ hay và hiếm về phân tích thiết kế, công nghệ phần mềm chuyên sâu.",
    stars: 250,
    downloads: 1200,
  },
  {
    title: "Sổ tay xây dựng ứng dụng phần mềm",
    description: "Hướng dẫn xây dựng phần mềm, web app thực tế, áp dụng công nghệ mới nhất.",
    stars: 180,
    downloads: 500,
  },
  {
    title: "Slide bài giảng CNPM nâng cao 2025",
    description: "Slide bài giảng đại học, các khái niệm cơ bản về công nghệ phần mềm.",
    stars: 5,
    downloads: 30,
  },
  {
    title: "Tiểu luận môn phần mềm rác",
    description: "Khóa luận cũ mèm viết linh tinh về CNPM không có giá trị học thuật cao.",
    stars: 0,
    downloads: 1,
  },
];

async function getFPTEmbedding(text: string): Promise<number[]> {
  const url = "https://mkp-api.fptcloud.com/embeddings";
  const body = JSON.stringify({
    input: text,
    model: "Vietnamese_Embedding",
  });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.FPT_API_KEY}`,
    },
    body,
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`FPT API Error ${res.status}: ${txt}`);
  }

  const json = await res.json();
  const vector = json.data?.[0]?.embedding;
  if (!vector || !Array.isArray(vector)) {
    throw new Error("Invalid embedding format from FPT AI");
  }
  return vector;
}

async function main() {
  console.log("Bat dau seed mock data...");
  const adminId = "08125b8f-6000-4437-b0c5-7f4cdce665f5";

  for (const doc of MOCK_DOCS) {
    const docId = uuidv4();
    console.log(`\nDoc: ${doc.title}`);

    // Insert doc
    await pool.query(
      `INSERT INTO documents (id, owner_id, title, description, mime, size, status, stars, downloads, object_key)
       VALUES ($1, $2, $3, $4, 'application/pdf', 1024, 'approved', $5, $6, $7)`,
      [docId, adminId, doc.title, doc.description, doc.stars, doc.downloads, docId + '.pdf']
    );

    // Get embedding combining title + desc
    const textContext = doc.title + "\n" + doc.description;
    const vector = await getFPTEmbedding(textContext);

    // Insert to doc_chunks
    const chunkId = uuidv4();
    await pool.query(
      `INSERT INTO doc_chunks (id, document_id, chunk_index, content, embedding)
       VALUES ($1, $2, 0, $3, $4::vector)`,
      [chunkId, docId, textContext, JSON.stringify(vector)]
    );

    console.log(`--> Da tao vector 1024-dim, sao=${doc.stars}, tai=${doc.downloads}`);
  }
  
  console.log("\nXONG! Da them du lieu mock thanh cong!");
  process.exit(0);
}

main().catch((e) => {
  console.error("Loi:", e);
  process.exit(1);
});

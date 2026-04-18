import { Router } from "express";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { requireAuth } from "../auth/middleware";
import { pool } from "../../db/pg";
import { ensureBucket, minio } from "./minio";
import { loadEnv } from "../../config/env";
import { publishDocumentUploaded } from "../../queue/publisher";

const env = loadEnv();
export const documentsRouter = Router();

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Normalize a filename so it contains only URL-safe ASCII characters.
 */
function sanitizeFilename(name: string): string {
  const noDiacritics = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const safe = noDiacritics.replace(/[^a-zA-Z0-9._\-]/g, "_");
  return safe.replace(/_+/g, "_").replace(/^_|_$/g, "");
}

/**
 * Replace the internal MinIO base URL with the public URL.
 */
function toPublicMinioUrl(internalUrl: string) {
  const internalBase = `http://${env.MINIO_ENDPOINT}:${env.MINIO_PORT}`;
  const publicBase = env.MINIO_PUBLIC_URL.replace(/\/+$/, "");
  return internalUrl.replace(internalBase, publicBase);
}

/**
 * Gọi FPT AI để lấy vector embedding của câu tìm kiếm.
 * FPT AI dùng format tương thích OpenAI 100%.
 * Trả về null nếu không có API key hoặc thất bại.
 */
async function getQueryEmbedding(query: string): Promise<number[] | null> {
  const apiKey = env.FPT_API_KEY;
  if (!apiKey || !query.trim()) return null;

  try {
    const resp = await fetch("https://mkp-api.fptcloud.com/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`, // FPT AI dùng Bearer token
      },
      body: JSON.stringify({
        model: "Vietnamese_Embedding", // 1024 chiều, hỗ trợ tiếng Việt tốt
        input: [query.slice(0, 8000)], // FPT API nhận input dạng array
      }),
    });

    if (!resp.ok) return null;

    const data = (await resp.json()) as {
      data: { embedding: number[] }[];
    };
    return data.data?.[0]?.embedding ?? null;
  } catch {
    return null;
  }
}


// ─── Upload Routes ───────────────────────────────────────────────────────────

documentsRouter.post("/presign", requireAuth, async (req, res) => {
  await ensureBucket();
  const body = z
    .object({
      filename: z.string().min(1),
      mime: z.string().min(1),
      size: z.number().int().positive(),
    })
    .parse(req.body);

  const objectKey = `${req.auth!.userId}/${uuidv4()}-${sanitizeFilename(body.filename)}`.replaceAll("..", ".");

  const internalUrl = await minio.presignedPutObject(env.MINIO_BUCKET, objectKey, 60 * 10);
  const presignedPutUrl = toPublicMinioUrl(internalUrl);

  return res.json({ objectKey, presignedPutUrl, expiresInSeconds: 600 });
});

documentsRouter.post("/complete", requireAuth, async (req, res) => {
  const body = z
    .object({
      objectKey: z.string().min(1),
      title: z.string().min(1),
      description: z.string().optional(),
      mime: z.string().min(1),
      size: z.number().int().positive(),
      categoryId: z.string().uuid().optional(),
      category: z.string().optional(),
      sha256: z.string().optional(),
    })
    .parse(req.body);

  let resolvedCategoryId: string | null = body.categoryId ?? null;
  if (!resolvedCategoryId && body.category) {
    const catRow = await pool.query(
      "SELECT id FROM categories WHERE slug = $1 LIMIT 1",
      [body.category],
    );
    if (catRow.rows.length > 0) {
      resolvedCategoryId = catRow.rows[0].id;
    }
  }

  const result = await pool.query(
    `INSERT INTO documents(owner_id, category_id, title, description, mime, size, sha256, object_key, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'uploaded')
     RETURNING id, owner_id, title, object_key, status, created_at`,
    [
      req.auth!.userId,
      resolvedCategoryId,
      body.title,
      body.description ?? null,
      body.mime,
      body.size,
      body.sha256 ?? null,
      body.objectKey,
    ],
  );

  const doc = result.rows[0];
  await publishDocumentUploaded({ documentId: doc.id });

  return res.status(201).json({ document: doc });
});

documentsRouter.get("/test-docs", async (req, res) => {
  const result = await pool.query(`
    SELECT d.id, d.title, d.status, d.owner_id 
    FROM documents d
  `);
  res.json({ docs: result.rows });
});

// ─── Search Route (Hybrid AI Search) ────────────────────────────────────────

/**
 * GET /documents?q=...&category=...&limit=20&page=1
 *
 * Thuật toán:
 * 1. Nếu có OPENAI_API_KEY: biến query thành vector → tìm 100 doc gần nhất (Vector Search)
 * 2. Nếu không có API key: fallback về ILIKE (keyword search)
 * 3. Tính Final Score = (vector_score * 0.5) + (stars * 0.3) + (downloads * 0.2) → normalize
 * 4. Trả về top {limit} tài liệu + flag is_starred của user hiện tại
 */
documentsRouter.get("/", requireAuth, async (req, res) => {
  const query = z
    .object({
      q:        z.string().optional(),
      category: z.string().optional(),  // slug của category
      limit:    z.coerce.number().int().min(1).max(50).default(20),
      page:     z.coerce.number().int().min(1).default(1),
    })
    .parse(req.query);

  const { q, category, limit, page } = query;
  const offset = (page - 1) * limit;
  const userId = req.auth!.userId;

  // ── Bước A: Lấy category_id nếu có filter ──────────────────────────────
  let categoryId: string | null = null;
  if (category) {
    const catRow = await pool.query(
      "SELECT id FROM categories WHERE slug = $1 LIMIT 1",
      [category],
    );
    categoryId = catRow.rows[0]?.id ?? null;
  }

  // ── Bước B: Thử Vector Search ───────────────────────────────────────────
  const queryVector = q ? await getQueryEmbedding(q) : null;

  if (queryVector) {
    // ✅ AI MODE: Vector Search + Heuristics Rescoring
    const vectorStr = `[${queryVector.join(",")}]`;

    // Lấy top 100 chunks gần nhất, rồi group theo document để lấy max score
    const categoryFilter = categoryId ? "AND d.category_id = $3" : "";
    const params: unknown[] = [vectorStr, 100];
    if (categoryId) params.push(categoryId);

    const vectorResult = await pool.query(
      `
      WITH vector_matches AS (
        SELECT
          dc.document_id,
          -- Cosine similarity: 1 - cosine_distance (pgvector dùng <=> cho cosine distance)
          MAX(1 - (dc.embedding <=> $1::vector)) AS vector_score
        FROM doc_chunks dc
        INNER JOIN documents d ON d.id = dc.document_id
        WHERE dc.embedding IS NOT NULL
          AND d.status = 'approved'
          ${categoryFilter}
        GROUP BY dc.document_id
        ORDER BY vector_score DESC
        LIMIT $2
      ),
      scored AS (
        SELECT
          d.id,
          d.title,
          d.description,
          d.mime,
          d.size,
          d.status,
          d.created_at,
          d.stars,
          d.downloads,
          d.category_id,
          c.slug  AS category_slug,
          c.name  AS category_name,
          u.display_name AS uploader_name,
          u.email        AS uploader_email,
          vm.vector_score,
          -- Normalize stars và downloads (log scale để tránh document có 10k download áp đảo)
          -- rồi tính Final Score
          (
            vm.vector_score * 0.5
            + LEAST(LN(d.stars + 1) / 10.0, 1.0) * 0.3
            + LEAST(LN(d.downloads + 1) / 10.0, 1.0) * 0.2
          ) AS final_score,
          -- Kiểm tra user có star tài liệu này chưa
          EXISTS(
            SELECT 1 FROM document_stars ds
            WHERE ds.document_id = d.id AND ds.user_id = '${userId}'
          ) AS is_starred
        FROM vector_matches vm
        INNER JOIN documents d ON d.id = vm.document_id
        LEFT JOIN users u ON u.id = d.owner_id
        LEFT JOIN categories c ON c.id = d.category_id
      )
      SELECT * FROM scored
      ORDER BY final_score DESC
      LIMIT ${limit} OFFSET ${offset}
      `,
      params,
    );

    return res.json({
      documents: vectorResult.rows,
      search_mode: "vector_ai",
      page,
      limit,
    });
  }

  // ── Fallback: Keyword Search (ILIKE) ────────────────────────────────────
  // Dùng khi không có OpenAI/FPT API key hoặc query rỗng
  const params: unknown[] = [];
  // Cho phép hiện list "chờ xử lý" nếu là tài liệu do chính user upload
  let conditions = `WHERE (d.status = 'approved' OR d.owner_id = '${userId}')`;

  if (q && q.trim()) {
    params.push(`%${q.trim()}%`);
    conditions += ` AND (d.title ILIKE $${params.length} OR d.description ILIKE $${params.length})`;
  }

  if (categoryId) {
    params.push(categoryId);
    conditions += ` AND d.category_id = $${params.length}`;
  }

  params.push(limit, offset);

  const keywordResult = await pool.query(
    `
    SELECT
      d.id, d.title, d.description, d.mime, d.size, d.status, d.created_at,
      d.stars, d.downloads, d.category_id,
      c.slug AS category_slug, c.name AS category_name,
      u.display_name AS uploader_name, u.email AS uploader_email,
      NULL::float AS vector_score,
      NULL::float AS final_score,
      EXISTS(
        SELECT 1 FROM document_stars ds
        WHERE ds.document_id = d.id AND ds.user_id = '${userId}'
      ) AS is_starred
    FROM documents d
    LEFT JOIN users u ON u.id = d.owner_id
    LEFT JOIN categories c ON c.id = d.category_id
    ${conditions}
    ORDER BY d.stars DESC, d.downloads DESC, d.created_at DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}
    `,
    params,
  );

  console.log(`[API] Fallback query returned ${keywordResult.rows.length} docs. Params:`, params, "Conditions:", conditions);

  return res.json({
    documents: keywordResult.rows,
    search_mode: "keyword_fallback",
    page,
    limit,
  });
});

// ─── Download Route (+ tăng counter) ────────────────────────────────────────

/**
 * GET /documents/:id/download
 * Trả về presigned URL tải file + tăng download counter lên 1
 */
documentsRouter.get("/:id/download", requireAuth, async (req, res) => {
  await ensureBucket();
  const id = z.string().uuid().parse(req.params.id);

  const result = await pool.query(
    "SELECT object_key FROM documents WHERE id=$1 AND status='approved'",
    [id],
  );
  const row = result.rows[0];
  if (!row) return res.status(404).json({ error: "not_found" });

  // Tăng download counter (fire & forget, không block response)
  pool.query(
    "UPDATE documents SET downloads = downloads + 1 WHERE id = $1",
    [id],
  ).catch((e) => console.warn("[Download] Counter update failed:", e));

  const internalUrl = await minio.presignedGetObject(env.MINIO_BUCKET, row.object_key, 60 * 10);
  const presignedGetUrl = toPublicMinioUrl(internalUrl);

  return res.json({ presignedGetUrl, expiresInSeconds: 600 });
});

// ─── Star / Unstar Route (GitHub-style) ─────────────────────────────────────

/**
 * POST /documents/:id/star
 * Toggle star: nếu chưa star thì star, nếu đã star thì bỏ star (unstar).
 * Trả về { starred: boolean, stars: number }
 */
documentsRouter.post("/:id/star", requireAuth, async (req, res) => {
  const documentId = z.string().uuid().parse(req.params.id);
  const userId = req.auth!.userId;

  // Kiểm tra document có tồn tại không
  const docCheck = await pool.query(
    "SELECT id FROM documents WHERE id=$1 AND status='approved'",
    [documentId],
  );
  if (!docCheck.rows[0]) {
    return res.status(404).json({ error: "not_found" });
  }

  // Kiểm tra đã star chưa
  const existing = await pool.query(
    "SELECT 1 FROM document_stars WHERE user_id=$1 AND document_id=$2",
    [userId, documentId],
  );

  let starred: boolean;

  if (existing.rows.length > 0) {
    // Đã star → Bỏ star (Unstar)
    await pool.query(
      "DELETE FROM document_stars WHERE user_id=$1 AND document_id=$2",
      [userId, documentId],
    );
    await pool.query(
      "UPDATE documents SET stars = GREATEST(stars - 1, 0) WHERE id=$1",
      [documentId],
    );
    starred = false;
  } else {
    // Chưa star → Thêm star
    await pool.query(
      "INSERT INTO document_stars(user_id, document_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [userId, documentId],
    );
    await pool.query(
      "UPDATE documents SET stars = stars + 1 WHERE id=$1",
      [documentId],
    );
    starred = true;
  }

  // Lấy tổng stars hiện tại
  const updatedDoc = await pool.query(
    "SELECT stars FROM documents WHERE id=$1",
    [documentId],
  );

  return res.json({
    starred,
    stars: updatedDoc.rows[0]?.stars ?? 0,
  });
});

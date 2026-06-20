import { pool } from "../config/db";

export async function findDocumentTitle(documentId: string): Promise<string | null> {
  const result = await pool.query("SELECT title FROM documents WHERE id=$1", [documentId]);
  return result.rows[0]?.title ?? null;
}

export async function findCategoryIdBySlug(slug: string): Promise<string | null> {
  const catRow = await pool.query("SELECT id FROM categories WHERE slug = $1 LIMIT 1", [slug]);
  return catRow.rows[0]?.id ?? null;
}

export async function insertDocument(data: {
  ownerId: string;
  categoryId: string | null;
  title: string;
  description: string | null;
  mime: string;
  size: number;
  sha256: string | null;
  objectKey: string;
}) {
  const result = await pool.query(
    `INSERT INTO documents(owner_id, category_id, title, description, mime, size, sha256, object_key, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'uploaded')
     RETURNING id, owner_id, title, object_key, status, created_at`,
    [data.ownerId, data.categoryId, data.title, data.description, data.mime, data.size, data.sha256, data.objectKey],
  );
  return result.rows[0];
}

export async function searchDocumentsVector(opts: {
  userId: string;
  vectorStr: string;
  categoryId: string | null;
  limit: number;
  offset: number;
}) {
  // Lấy top 100 chunks gần nhất, rồi group theo document để lấy max score
  const params: unknown[] = [opts.vectorStr, 100];
  let categoryParamIdx: number | null = null;
  if (opts.categoryId) {
    params.push(opts.categoryId);
    categoryParamIdx = params.length;
  }
  params.push(opts.userId);
  const userParamIdx = params.length;
  params.push(opts.limit);
  const limitParamIdx = params.length;
  params.push(opts.offset);
  const offsetParamIdx = params.length;

  const categoryFilter = categoryParamIdx ? `AND d.category_id = $${categoryParamIdx}` : "";

  const result = await pool.query(
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
          WHERE ds.document_id = d.id AND ds.user_id = $${userParamIdx}
        ) AS is_starred
      FROM vector_matches vm
      INNER JOIN documents d ON d.id = vm.document_id
      LEFT JOIN users u ON u.id = d.owner_id
      LEFT JOIN categories c ON c.id = d.category_id
    )
    SELECT * FROM scored
    ORDER BY final_score DESC
    LIMIT $${limitParamIdx} OFFSET $${offsetParamIdx}
    `,
    params,
  );

  return result.rows;
}

export async function searchDocumentsKeyword(opts: {
  userId: string;
  q?: string;
  categoryId: string | null;
  limit: number;
  offset: number;
}) {
  // Cho phép hiện list "chờ xử lý" nếu là tài liệu do chính user upload
  const params: unknown[] = [opts.userId];
  let conditions = `WHERE (d.status = 'approved' OR d.owner_id = $1)`;

  if (opts.q && opts.q.trim()) {
    params.push(`%${opts.q.trim()}%`);
    conditions += ` AND (d.title ILIKE $${params.length} OR d.description ILIKE $${params.length})`;
  }

  if (opts.categoryId) {
    params.push(opts.categoryId);
    conditions += ` AND d.category_id = $${params.length}`;
  }

  params.push(opts.limit, opts.offset);
  const limitParamIdx = params.length - 1;
  const offsetParamIdx = params.length;

  const result = await pool.query(
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
        WHERE ds.document_id = d.id AND ds.user_id = $1
      ) AS is_starred
    FROM documents d
    LEFT JOIN users u ON u.id = d.owner_id
    LEFT JOIN categories c ON c.id = d.category_id
    ${conditions}
    ORDER BY d.stars DESC, d.downloads DESC, d.created_at DESC
    LIMIT $${limitParamIdx} OFFSET $${offsetParamIdx}
    `,
    params,
  );

  console.log(`[document.model] Keyword search returned ${result.rows.length} docs. Conditions:`, conditions);

  return result.rows;
}

export async function findApprovedDocumentObjectKey(documentId: string): Promise<string | null> {
  const result = await pool.query(
    "SELECT object_key FROM documents WHERE id=$1 AND status='approved'",
    [documentId],
  );
  return result.rows[0]?.object_key ?? null;
}

export async function incrementDownloadCount(documentId: string) {
  return pool.query(
    "UPDATE documents SET downloads = downloads + 1 WHERE id = $1",
    [documentId],
  );
}

export async function isDocumentApproved(documentId: string): Promise<boolean> {
  const result = await pool.query(
    "SELECT id FROM documents WHERE id=$1 AND status='approved'",
    [documentId],
  );
  return !!result.rows[0];
}

export async function findUserStar(userId: string, documentId: string): Promise<boolean> {
  const result = await pool.query(
    "SELECT 1 FROM document_stars WHERE user_id=$1 AND document_id=$2",
    [userId, documentId],
  );
  return result.rows.length > 0;
}

export async function deleteStar(userId: string, documentId: string) {
  await pool.query(
    "DELETE FROM document_stars WHERE user_id=$1 AND document_id=$2",
    [userId, documentId],
  );
}

export async function insertStar(userId: string, documentId: string) {
  await pool.query(
    "INSERT INTO document_stars(user_id, document_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
    [userId, documentId],
  );
}

export async function decrementStars(documentId: string) {
  await pool.query(
    "UPDATE documents SET stars = GREATEST(stars - 1, 0) WHERE id=$1",
    [documentId],
  );
}

export async function incrementStars(documentId: string) {
  await pool.query(
    "UPDATE documents SET stars = stars + 1 WHERE id=$1",
    [documentId],
  );
}

export async function getStarsCount(documentId: string): Promise<number> {
  const result = await pool.query("SELECT stars FROM documents WHERE id=$1", [documentId]);
  return result.rows[0]?.stars ?? 0;
}

export async function insertDocumentReport(userId: string, documentId: string, reason: string) {
  await pool.query(
    "INSERT INTO document_reports(user_id, document_id, reason) VALUES ($1, $2, $3)",
    [userId, documentId, reason],
  );
}

// ─── Admin moderation ─────────────────────────────────────────────────────────

export async function listReportsWithDetails() {
  const query = `
    SELECT
      dr.id, dr.reason, dr.created_at,
      u.email as reporter_email,
      d.id as document_id, d.title as document_title, d.status as document_status
    FROM document_reports dr
    JOIN users u ON dr.user_id = u.id
    JOIN documents d ON dr.document_id = d.id
    ORDER BY dr.created_at DESC
  `;
  const { rows } = await pool.query(query);
  return rows;
}

export async function dismissReportById(id: string) {
  await pool.query("DELETE FROM document_reports WHERE id = $1", [id]);
}

export async function deleteDocumentById(id: string) {
  // This will cascade delete document_reports, document_stars, etc.
  await pool.query("DELETE FROM documents WHERE id = $1", [id]);
}

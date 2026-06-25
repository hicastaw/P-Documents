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

const VECTOR_SIMILARITY_MIN = 0.5;

export async function searchDocumentsVectorRanked(opts: {
  vectorStr: string;
  categoryId: string | null;
  candidateLimit: number;
}): Promise<{ document_id: string }[]> {
  const params: unknown[] = [opts.vectorStr, opts.candidateLimit];
  const categoryFilter = opts.categoryId ? `AND d.category_id = $3` : "";
  if (opts.categoryId) params.push(opts.categoryId);

  const result = await pool.query(
    `
    SELECT dc.document_id
    FROM doc_chunks dc
    INNER JOIN documents d ON d.id = dc.document_id
    WHERE dc.embedding IS NOT NULL
      AND d.status = 'approved'
      ${categoryFilter}
    GROUP BY dc.document_id
    HAVING MAX(1 - (dc.embedding <=> $1::vector)) > ${VECTOR_SIMILARITY_MIN}
    ORDER BY MAX(1 - (dc.embedding <=> $1::vector)) DESC
    LIMIT $2
    `,
    params,
  );

  return result.rows;
}

/**
 * Keyword ranking trên title+description VÀ nội dung tài liệu (doc_chunks),
 * dùng config 'vi_unaccent' (bỏ dấu tiếng Việt) + GIN index trên cả 2 nguồn
 * (idx_documents_fulltext, idx_doc_chunks_fulltext — xem migration 003) thay
 * vì string_agg toàn bộ chunk của mọi document mỗi lần search (rất chậm khi
 * corpus lớn). Trước đây chỉ ILIKE title/description, "mù" với nội dung khi
 * không có AI embedding — UNION 2 nguồn dưới đây vá luôn lỗ hổng đó.
 */
export async function searchDocumentsKeywordRanked(opts: {
  q: string;
  categoryId: string | null;
  candidateLimit: number;
}): Promise<{ document_id: string }[]> {
  const params: unknown[] = [opts.q, opts.candidateLimit];
  const categoryFilter = opts.categoryId ? `AND d.category_id = $3` : "";
  if (opts.categoryId) params.push(opts.categoryId);

  const result = await pool.query(
    `
    WITH title_match AS (
      SELECT d.id AS document_id,
             ts_rank(to_tsvector('vi_unaccent', d.title || ' ' || coalesce(d.description,'')), plainto_tsquery('vi_unaccent', $1)) AS score
      FROM documents d
      WHERE d.status = 'approved'
        ${categoryFilter}
        AND to_tsvector('vi_unaccent', d.title || ' ' || coalesce(d.description,'')) @@ plainto_tsquery('vi_unaccent', $1)
    ),
    content_match AS (
      SELECT dc.document_id,
             MAX(ts_rank(to_tsvector('vi_unaccent', dc.content), plainto_tsquery('vi_unaccent', $1))) AS score
      FROM doc_chunks dc
      INNER JOIN documents d ON d.id = dc.document_id
      WHERE d.status = 'approved'
        ${categoryFilter}
        AND to_tsvector('vi_unaccent', dc.content) @@ plainto_tsquery('vi_unaccent', $1)
      GROUP BY dc.document_id
    )
    SELECT document_id, MAX(score) AS kw_score
    FROM (SELECT * FROM title_match UNION ALL SELECT * FROM content_match) combined
    GROUP BY document_id
    ORDER BY kw_score DESC
    LIMIT $2
    `,
    params,
  );

  return result.rows;
}

export async function listDocumentsDefault(opts: {
  userId: string;
  categoryId: string | null;
  limit: number;
  offset: number;
}) {
  const params: unknown[] = [opts.userId];
  let conditions = `WHERE (d.status = 'approved' OR d.owner_id = $1)`;

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
      d.id, d.title, d.description, d.mime, d.size, d.status, d.chunk_status, d.created_at,
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

  return result.rows;
}

export async function hydrateDocumentsByIds(opts: {
  ids: string[];
  userId: string;
}) {
  if (opts.ids.length === 0) return [];

  const result = await pool.query(
    `
    SELECT
      d.id, d.title, d.description, d.mime, d.size, d.status, d.chunk_status, d.created_at,
      d.stars, d.downloads, d.category_id,
      c.slug AS category_slug, c.name AS category_name,
      u.display_name AS uploader_name, u.email AS uploader_email,
      EXISTS(
        SELECT 1 FROM document_stars ds
        WHERE ds.document_id = d.id AND ds.user_id = $2
      ) AS is_starred
    FROM documents d
    LEFT JOIN users u ON u.id = d.owner_id
    LEFT JOIN categories c ON c.id = d.category_id
    WHERE d.id = ANY($1::uuid[])
    `,
    [opts.ids, opts.userId],
  );

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

import { pool } from "../config/db";

export interface ChatChunk {
  chunk_index: number;
  content: string;
  document_id: string;
}

export async function findChunksByVector(vectorStr: string, documentId: string | undefined, limit: number): Promise<ChatChunk[]> {
  if (documentId) {
    const r = await pool.query(
      `SELECT chunk_index, content, document_id,
              1 - (embedding <=> $1::vector) AS similarity
       FROM doc_chunks
       WHERE document_id = $2
         AND embedding IS NOT NULL
       ORDER BY embedding <=> $1::vector ASC
       LIMIT $3`,
      [vectorStr, documentId, limit],
    );
    return r.rows;
  }

  const r = await pool.query(
    `SELECT dc.chunk_index, dc.content, dc.document_id,
            1 - (dc.embedding <=> $1::vector) AS similarity
     FROM doc_chunks dc
     INNER JOIN documents d ON d.id = dc.document_id
     WHERE dc.embedding IS NOT NULL
       AND d.status = 'approved'
     ORDER BY dc.embedding <=> $1::vector ASC
     LIMIT $2`,
    [vectorStr, limit],
  );
  return r.rows;
}

/**
 * Keyword ranking thật (ts_rank) trên toàn bộ keyword của câu hỏi, thay vì
 * chỉ ILIKE từ đầu tiên không có ranking như trước.
 */
export async function findChunksByKeywordRanked(keywords: string[], documentId: string | undefined, limit: number): Promise<ChatChunk[]> {
  const tsQuery = keywords
    .map((k) => k.replace(/[^\p{L}\p{N}\s]/gu, "").trim())
    .filter(Boolean)
    .join(" | ");
  if (!tsQuery) return [];

  if (documentId) {
    const r = await pool.query(
      `SELECT chunk_index, content, document_id
       FROM doc_chunks
       WHERE document_id=$1 AND to_tsvector('vi_unaccent', content) @@ to_tsquery('vi_unaccent', $2)
       ORDER BY ts_rank(to_tsvector('vi_unaccent', content), to_tsquery('vi_unaccent', $2)) DESC
       LIMIT $3`,
      [documentId, tsQuery, limit],
    );
    return r.rows;
  }

  const r = await pool.query(
    `SELECT dc.chunk_index, dc.content, dc.document_id
     FROM doc_chunks dc
     INNER JOIN documents d ON d.id = dc.document_id
     WHERE to_tsvector('simple', dc.content) @@ to_tsquery('vi_unaccent', $1)
       AND d.status = 'approved'
     ORDER BY ts_rank(to_tsvector('simple', dc.content), to_tsquery('vi_unaccent', $1)) DESC
     LIMIT $2`,
    [tsQuery, limit],
  );
  return r.rows;
}

export async function findFirstChunks(documentId: string | undefined, limit: number): Promise<ChatChunk[]> {
  if (documentId) {
    const r = await pool.query(
      `SELECT chunk_index, content, document_id
       FROM doc_chunks
       WHERE document_id=$1
       ORDER BY chunk_index ASC LIMIT $2`,
      [documentId, limit],
    );
    return r.rows;
  }

  const r = await pool.query(
    `SELECT dc.chunk_index, dc.content, dc.document_id
     FROM doc_chunks dc
     INNER JOIN documents d ON d.id = dc.document_id
     WHERE d.status = 'approved'
     ORDER BY dc.document_id, dc.chunk_index ASC LIMIT $1`,
    [limit],
  );
  return r.rows;
}

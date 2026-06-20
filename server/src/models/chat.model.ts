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

export async function findChunksByKeyword(keyword: string, documentId: string | undefined, limit: number): Promise<ChatChunk[]> {
  const like = `%${keyword}%`;
  if (documentId) {
    const r = await pool.query(
      `SELECT chunk_index, content, document_id
       FROM doc_chunks
       WHERE document_id=$1 AND content ILIKE $2
       ORDER BY chunk_index ASC LIMIT $3`,
      [documentId, like, limit],
    );
    return r.rows;
  }

  const r = await pool.query(
    `SELECT dc.chunk_index, dc.content, dc.document_id
     FROM doc_chunks dc
     INNER JOIN documents d ON d.id = dc.document_id
     WHERE dc.content ILIKE $1
       AND d.status = 'approved'
     ORDER BY dc.chunk_index ASC LIMIT $2`,
    [like, limit],
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

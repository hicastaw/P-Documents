import { pool } from "../config/db";

export async function listThreads(q?: string) {
  const params: any[] = [];
  let sql = `
    SELECT t.id, t.title, t.body, t.created_at, t.updated_at,
           u.id AS author_id, u.display_name AS author_name, u.email AS author_email,
           (SELECT COUNT(*) FROM forum_posts p WHERE p.thread_id = t.id)::int AS post_count
    FROM forum_threads t
    LEFT JOIN users u ON u.id = t.author_id
  `;
  if (q && q.trim()) {
    params.push(`%${q.trim()}%`);
    sql += " WHERE (t.title ILIKE $1 OR t.body ILIKE $1)";
  }
  sql += " ORDER BY t.updated_at DESC LIMIT 50";
  const result = await pool.query(sql, params);
  return result.rows;
}

export async function insertThread(title: string, body: string, authorId: string) {
  const result = await pool.query(
    `INSERT INTO forum_threads(title, body, author_id)
     VALUES ($1, $2, $3)
     RETURNING id, title, body, author_id, created_at, updated_at`,
    [title, body, authorId],
  );
  return result.rows[0];
}

export async function findThreadWithAuthor(threadId: string) {
  const result = await pool.query(
    `SELECT t.id, t.title, t.body, t.created_at, t.updated_at,
            u.id AS author_id, u.display_name AS author_name, u.email AS author_email
     FROM forum_threads t
     LEFT JOIN users u ON u.id = t.author_id
     WHERE t.id = $1`,
    [threadId],
  );
  return result.rows[0] ?? null;
}

export async function listPostsByThread(threadId: string) {
  const result = await pool.query(
    `SELECT p.id, p.body, p.parent_id, p.created_at,
            u.id AS author_id, u.display_name AS author_name, u.email AS author_email
     FROM forum_posts p
     LEFT JOIN users u ON u.id = p.author_id
     WHERE p.thread_id = $1
     ORDER BY p.created_at ASC`,
    [threadId],
  );
  return result.rows;
}

export async function findThreadAuthorId(threadId: string): Promise<string | null> {
  const result = await pool.query("SELECT id, author_id FROM forum_threads WHERE id=$1", [threadId]);
  return result.rows[0]?.author_id ?? null;
}

export async function insertPost(threadId: string, authorId: string, body: string, parentId: string | null) {
  const result = await pool.query(
    `INSERT INTO forum_posts(thread_id, author_id, body, parent_id)
     VALUES ($1, $2, $3, $4)
     RETURNING id, thread_id, author_id, body, parent_id, created_at`,
    [threadId, authorId, body, parentId],
  );
  return result.rows[0];
}

export async function touchThreadUpdatedAt(threadId: string) {
  await pool.query("UPDATE forum_threads SET updated_at = now() WHERE id = $1", [threadId]);
}

export async function findPostAuthorId(postId: string): Promise<string | null> {
  const result = await pool.query("SELECT author_id FROM forum_posts WHERE id=$1", [postId]);
  return result.rows[0]?.author_id ?? null;
}

export async function deletePostByOwner(postId: string, authorId: string): Promise<boolean> {
  const result = await pool.query(
    "DELETE FROM forum_posts WHERE id=$1 AND author_id=$2 RETURNING id",
    [postId, authorId],
  );
  return !!result.rows[0];
}

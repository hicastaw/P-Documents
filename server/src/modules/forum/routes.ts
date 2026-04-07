import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { pool } from "../../db/pg";
import { requireAuth } from "../auth/middleware";

export const forumRouter = Router();

// ── List threads ──────────────────────────────────────────
forumRouter.get("/threads", requireAuth, async (req: Request, res: Response) => {
  const q = z.string().optional().parse(req.query.q);
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
  return res.json({ threads: result.rows });
});

// ── Create thread ─────────────────────────────────────────
forumRouter.post("/threads", requireAuth, async (req: Request, res: Response) => {
  const body = z
    .object({
      title: z.string().min(1).max(200),
      body: z.string().min(1).max(10000),
    })
    .parse(req.body);

  const result = await pool.query(
    `INSERT INTO forum_threads(title, body, author_id)
     VALUES ($1, $2, $3)
     RETURNING id, title, body, author_id, created_at, updated_at`,
    [body.title, body.body, req.auth!.userId],
  );
  return res.status(201).json({ thread: result.rows[0] });
});

// ── Get thread detail + posts ─────────────────────────────
forumRouter.get("/threads/:id", requireAuth, async (req: Request, res: Response) => {
  const threadId = z.string().uuid().parse(req.params.id);

  const threadRes = await pool.query(
    `SELECT t.id, t.title, t.body, t.created_at, t.updated_at,
            u.id AS author_id, u.display_name AS author_name, u.email AS author_email
     FROM forum_threads t
     LEFT JOIN users u ON u.id = t.author_id
     WHERE t.id = $1`,
    [threadId],
  );
  if (!threadRes.rows[0]) return res.status(404).json({ error: "not_found" });

  const postsRes = await pool.query(
    `SELECT p.id, p.body, p.parent_id, p.created_at,
            u.id AS author_id, u.display_name AS author_name, u.email AS author_email
     FROM forum_posts p
     LEFT JOIN users u ON u.id = p.author_id
     WHERE p.thread_id = $1
     ORDER BY p.created_at ASC`,
    [threadId],
  );

  return res.json({ thread: threadRes.rows[0], posts: postsRes.rows });
});

// ── Add post/reply to thread ──────────────────────────────
forumRouter.post("/threads/:id/posts", requireAuth, async (req: Request, res: Response) => {
  const threadId = z.string().uuid().parse(req.params.id);
  const body = z
    .object({
      body: z.string().min(1).max(5000),
      parentId: z.string().uuid().optional(),
    })
    .parse(req.body);

  // Verify thread exists
  const threadCheck = await pool.query("SELECT id, author_id FROM forum_threads WHERE id=$1", [threadId]);
  if (!threadCheck.rows[0]) return res.status(404).json({ error: "thread_not_found" });

  const result = await pool.query(
    `INSERT INTO forum_posts(thread_id, author_id, body, parent_id)
     VALUES ($1, $2, $3, $4)
     RETURNING id, thread_id, author_id, body, parent_id, created_at`,
    [threadId, req.auth!.userId, body.body, body.parentId ?? null],
  );

  // Update thread's updated_at
  await pool.query("UPDATE forum_threads SET updated_at = now() WHERE id = $1", [threadId]);

  // Create notification for thread author (if not self)
  const threadAuthorId = threadCheck.rows[0].author_id;
  if (threadAuthorId !== req.auth!.userId) {
    const posterRes = await pool.query("SELECT display_name FROM users WHERE id=$1", [req.auth!.userId]);
    const posterName = posterRes.rows[0]?.display_name ?? "Ai đó";
    await pool.query(
      `INSERT INTO notifications(user_id, type, title, body, ref_id)
       VALUES ($1, 'forum_reply', $2, $3, $4)`,
      [threadAuthorId, `${posterName} đã trả lời chủ đề của bạn`, body.body.slice(0, 100), threadId],
    );

    // Emit real-time notification
    const io = req.app.get("io");
    if (io) {
      io.emit(`notify:${threadAuthorId}`, {
        type: "forum_reply",
        title: `${posterName} đã trả lời chủ đề của bạn`,
        refId: threadId,
      });
    }
  }

  // If replying to a post, also notify the parent post's author
  if (body.parentId) {
    const parentRes = await pool.query("SELECT author_id FROM forum_posts WHERE id=$1", [body.parentId]);
    const parentAuthorId = parentRes.rows[0]?.author_id;
    if (parentAuthorId && parentAuthorId !== req.auth!.userId && parentAuthorId !== threadAuthorId) {
      const posterRes = await pool.query("SELECT display_name FROM users WHERE id=$1", [req.auth!.userId]);
      const posterName = posterRes.rows[0]?.display_name ?? "Ai đó";
      await pool.query(
        `INSERT INTO notifications(user_id, type, title, body, ref_id)
         VALUES ($1, 'forum_reply', $2, $3, $4)`,
        [parentAuthorId, `${posterName} đã trả lời bình luận của bạn`, body.body.slice(0, 100), threadId],
      );
      const io = req.app.get("io");
      if (io) io.emit(`notify:${parentAuthorId}`, { type: "forum_reply", title: `${posterName} đã trả lời bình luận của bạn`, refId: threadId });
    }
  }

  return res.status(201).json({ post: result.rows[0] });
});

// ── Delete own post ───────────────────────────────────────
forumRouter.delete("/posts/:id", requireAuth, async (req: Request, res: Response) => {
  const postId = z.string().uuid().parse(req.params.id);
  const result = await pool.query(
    "DELETE FROM forum_posts WHERE id=$1 AND author_id=$2 RETURNING id",
    [postId, req.auth!.userId],
  );
  if (!result.rows[0]) return res.status(404).json({ error: "not_found_or_not_owner" });
  return res.json({ ok: true });
});

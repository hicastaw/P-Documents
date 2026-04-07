import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { pool } from "../../db/pg";
import { requireAuth } from "../auth/middleware";

export const notificationsRouter = Router();

// List notifications for current user
notificationsRouter.get("/", requireAuth, async (req: Request, res: Response) => {
  const result = await pool.query(
    `SELECT id, type, title, body, ref_id, read, created_at
     FROM notifications
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 50`,
    [req.auth!.userId],
  );
  const unreadCount = result.rows.filter((r: any) => !r.read).length;
  return res.json({ notifications: result.rows, unreadCount });
});

// Mark single notification as read
notificationsRouter.patch("/:id/read", requireAuth, async (req: Request, res: Response) => {
  const id = z.string().uuid().parse(req.params.id);
  await pool.query(
    "UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2",
    [id, req.auth!.userId],
  );
  return res.json({ ok: true });
});

// Mark all as read
notificationsRouter.patch("/read-all", requireAuth, async (req: Request, res: Response) => {
  await pool.query(
    "UPDATE notifications SET read = true WHERE user_id = $1 AND read = false",
    [req.auth!.userId],
  );
  return res.json({ ok: true });
});

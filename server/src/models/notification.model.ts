import { pool } from "../config/db";

export async function listNotificationsByUser(userId: string) {
  const result = await pool.query(
    `SELECT id, type, title, body, ref_id, read, created_at
     FROM notifications
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 50`,
    [userId],
  );
  return result.rows;
}

export async function markNotificationRead(id: string, userId: string) {
  await pool.query(
    "UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2",
    [id, userId],
  );
}

export async function markAllNotificationsRead(userId: string) {
  await pool.query(
    "UPDATE notifications SET read = true WHERE user_id = $1 AND read = false",
    [userId],
  );
}

export async function insertNotification(opts: {
  userId: string;
  type: string;
  title: string;
  body: string;
  refId: string;
}) {
  await pool.query(
    `INSERT INTO notifications(user_id, type, title, body, ref_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [opts.userId, opts.type, opts.title, opts.body, opts.refId],
  );
}

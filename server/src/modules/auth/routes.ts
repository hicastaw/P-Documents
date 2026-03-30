import { Router, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { pool } from "../../db/pg";
import { loadEnv } from "../../config/env";
import { redis } from "../../redis/client";
import { requireAuth } from "./middleware";
import { signAccessToken, signRefreshToken } from "./jwt";

const env = loadEnv();

export const authRouter = Router();

authRouter.post("/register", async (req: Request, res: Response) => {
  const body = z
    .object({
      email: z.string().email(),
      password: z.string().min(8),
      displayName: z.string().min(2).max(50),
    })
    .parse(req.body);

  try {
    const passwordHash = await bcrypt.hash(body.password, 10);
    const result = await pool.query(
      "INSERT INTO users(email, password_hash, display_name) VALUES ($1,$2,$3) RETURNING id,email,display_name,created_at",
      [body.email.toLowerCase(), passwordHash, body.displayName],
    );

    return res.status(201).json({ user: result.rows[0] });
  } catch (err: any) {
    if (err?.code === "23505") {
      return res.status(409).json({ error: "email_exists" });
    }
    throw err;
  }
});

authRouter.post("/login", async (req: Request, res: Response) => {
  const body = z
    .object({
      email: z.string().email(),
      password: z.string().min(1),
    })
    .parse(req.body);

  const result = await pool.query("SELECT id, email, password_hash, display_name FROM users WHERE email=$1", [
    body.email.toLowerCase(),
  ]);
  const user = result.rows[0];
  if (!user) return res.status(401).json({ error: "invalid_credentials" });

  const ok = await bcrypt.compare(body.password, user.password_hash);
  if (!ok) return res.status(401).json({ error: "invalid_credentials" });

  const access = signAccessToken(user.id);
  const refresh = signRefreshToken(user.id);

  return res.json({
    user: { id: user.id, email: user.email, displayName: user.display_name },
    accessToken: access.token,
    refreshToken: refresh.token,
    accessExpiresIn: env.JWT_ACCESS_TTL_SECONDS,
    refreshExpiresIn: env.JWT_REFRESH_TTL_SECONDS,
  });
});

authRouter.post("/logout", requireAuth, async (req: Request, res: Response) => {
  const jti = req.auth!.jti;
  await redis.set(`jwt:blacklist:${jti}`, "1", { EX: env.JWT_ACCESS_TTL_SECONDS });
  return res.json({ ok: true });
});

authRouter.get("/me", requireAuth, async (req: Request, res: Response) => {
  const result = await pool.query("SELECT id,email,display_name,created_at FROM users WHERE id=$1", [req.auth!.userId]);
  const user = result.rows[0];
  return res.json({ user });
});

authRouter.patch("/profile", requireAuth, async (req: Request, res: Response) => {
  const body = z
    .object({
      displayName: z.string().min(2).max(50).optional(),
      currentPassword: z.string().optional(),
      newPassword: z.string().min(8).optional(),
    })
    .parse(req.body);

  const userRes = await pool.query(
    "SELECT id, password_hash, display_name FROM users WHERE id=$1",
    [req.auth!.userId]
  );
  const user = userRes.rows[0];
  if (!user) return res.status(404).json({ error: "user_not_found" });

  const updates: string[] = [];
  const values: any[] = [];
  let paramIdx = 1;

  // Update display name
  if (body.displayName !== undefined) {
    updates.push(`display_name = $${paramIdx++}`);
    values.push(body.displayName);
  }

  // Update password
  if (body.newPassword !== undefined) {
    if (!body.currentPassword) {
      return res.status(400).json({ error: "current_password_required" });
    }
    const ok = await bcrypt.compare(body.currentPassword, user.password_hash);
    if (!ok) return res.status(401).json({ error: "wrong_current_password" });
    const newHash = await bcrypt.hash(body.newPassword, 10);
    updates.push(`password_hash = $${paramIdx++}`);
    values.push(newHash);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: "nothing_to_update" });
  }

  values.push(req.auth!.userId);
  const result = await pool.query(
    `UPDATE users SET ${updates.join(", ")} WHERE id = $${paramIdx} RETURNING id, email, display_name`,
    values
  );

  return res.json({ user: result.rows[0] });
});


import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { pool } from "../../db/pg";
import { loadEnv } from "../../config/env";
import { redis } from "../../redis/client";
import { requireAuth } from "./middleware";
import { signAccessToken, signRefreshToken } from "./jwt";

const env = loadEnv();

export const authRouter = Router();

authRouter.post("/register", async (req, res) => {
  const body = z
    .object({
      email: z.string().email(),
      password: z.string().min(8),
      displayName: z.string().min(2).max(50),
    })
    .parse(req.body);

  const passwordHash = await bcrypt.hash(body.password, 10);
  const result = await pool.query(
    "INSERT INTO users(email, password_hash, display_name) VALUES ($1,$2,$3) RETURNING id,email,display_name,created_at",
    [body.email.toLowerCase(), passwordHash, body.displayName],
  );

  return res.status(201).json({ user: result.rows[0] });
});

authRouter.post("/login", async (req, res) => {
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

authRouter.post("/logout", requireAuth, async (req, res) => {
  const jti = req.auth!.jti;
  await redis.set(`jwt:blacklist:${jti}`, "1", { EX: env.JWT_ACCESS_TTL_SECONDS });
  return res.json({ ok: true });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const result = await pool.query("SELECT id,email,display_name,created_at FROM users WHERE id=$1", [req.auth!.userId]);
  const user = result.rows[0];
  return res.json({ user });
});


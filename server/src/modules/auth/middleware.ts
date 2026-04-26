import { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "./jwt";
import { redis } from "../../redis/client";
import { pool } from "../../db/pg";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
    interface Request {
      auth?: { userId: string; jti: string };
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.header("authorization");
    const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
    if (!token) return res.status(401).json({ error: "missing_token" });

    const claims = verifyAccessToken(token);

    const isBlacklisted = await redis.exists(`jwt:blacklist:${claims.jti}`);
    if (isBlacklisted) return res.status(401).json({ error: "token_revoked" });

    req.auth = { userId: claims.sub, jti: claims.jti };
    return next();
  } catch {
    return res.status(401).json({ error: "invalid_token" });
  }
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  requireAuth(req, res, async () => {
    try {
      if (!req.auth?.userId) return res.status(401).json({ error: "missing_token" });
      const { rows } = await pool.query("SELECT role FROM users WHERE id=$1", [req.auth.userId]);
      if (!rows[0] || rows[0].role !== "admin") {
        return res.status(403).json({ error: "forbidden" });
      }
      return next();
    } catch (err) {
      console.error("[requireAdmin] error:", err);
      return res.status(500).json({ error: "internal_error" });
    }
  });
}


import { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "./jwt";
import { redis } from "../../redis/client";

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


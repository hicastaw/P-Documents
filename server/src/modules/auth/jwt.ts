import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { loadEnv } from "../../config/env";

const env = loadEnv();

export type JwtClaims = {
  sub: string;
  jti: string;
};

export function signAccessToken(userId: string) {
  const claims: JwtClaims = { sub: userId, jti: uuidv4() };
  const token = jwt.sign(claims, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL_SECONDS,
  });
  return { token, claims };
}

export function signRefreshToken(userId: string) {
  const claims: JwtClaims = { sub: userId, jti: uuidv4() };
  const token = jwt.sign(claims, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_TTL_SECONDS,
  });
  return { token, claims };
}

export function verifyAccessToken(token: string): JwtClaims {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtClaims;
}


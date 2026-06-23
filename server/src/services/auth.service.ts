import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { loadEnv } from "../config/env";
import { redis } from "../config/redis";
import * as userModel from "../models/user.model";

const env = loadEnv();

export type JwtClaims = { sub: string; jti: string };

export function signAccessToken(userId: string) {
  const claims: JwtClaims = { sub: userId, jti: uuidv4() };
  const token = jwt.sign(claims, env.JWT_ACCESS_SECRET, { expiresIn: env.JWT_ACCESS_TTL_SECONDS });
  return { token, claims };
}

export function signRefreshToken(userId: string) {
  const claims: JwtClaims = { sub: userId, jti: uuidv4() };
  const token = jwt.sign(claims, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_TTL_SECONDS });
  return { token, claims };
}

export function verifyAccessToken(token: string): JwtClaims {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtClaims;
}

export function verifyRefreshToken(token: string): JwtClaims {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtClaims;
}

export async function register(email: string, password: string, displayName: string) {
  const passwordHash = await bcrypt.hash(password, 10);
  try {
    return await userModel.insertUser(email.toLowerCase(), passwordHash, displayName);
  } catch (err: any) {
    if (err?.code === "23505") {
      throw Object.assign(new Error("email_exists"), { statusCode: 409 });
    }
    throw err;
  }
}

export async function login(email: string, password: string) {
  const user = await userModel.findUserByEmail(email.toLowerCase());
  if (!user) throw Object.assign(new Error("invalid_credentials"), { statusCode: 401 });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) throw Object.assign(new Error("invalid_credentials"), { statusCode: 401 });

  const access = signAccessToken(user.id);
  const refresh = signRefreshToken(user.id);

  return {
    user: { id: user.id, email: user.email, displayName: user.display_name, role: user.role },
    accessToken: access.token,
    refreshToken: refresh.token,
    accessExpiresIn: env.JWT_ACCESS_TTL_SECONDS,
    refreshExpiresIn: env.JWT_REFRESH_TTL_SECONDS,
  };
}

export async function logout(jti: string, refreshToken?: string) {
  await redis.set(`jwt:blacklist:${jti}`, "1", { EX: env.JWT_ACCESS_TTL_SECONDS });

  if (refreshToken) {
    try {
      const claims = verifyRefreshToken(refreshToken);
      await redis.set(`jwt:blacklist:${claims.jti}`, "1", { EX: env.JWT_REFRESH_TTL_SECONDS });
    } catch {
      // refresh token already invalid/expired — nothing to revoke
    }
  }
}

export async function refresh(refreshToken: string) {
  let claims: JwtClaims;
  try {
    claims = verifyRefreshToken(refreshToken);
  } catch {
    throw Object.assign(new Error("invalid_refresh_token"), { statusCode: 401 });
  }

  const isBlacklisted = await redis.exists(`jwt:blacklist:${claims.jti}`);
  if (isBlacklisted) {
    throw Object.assign(new Error("refresh_token_revoked"), { statusCode: 401 });
  }

  const user = await userModel.findUserById(claims.sub);
  if (!user) throw Object.assign(new Error("user_not_found"), { statusCode: 401 });

  // Rotate: invalidate the old refresh token so it can't be replayed after this point
  await redis.set(`jwt:blacklist:${claims.jti}`, "1", { EX: env.JWT_REFRESH_TTL_SECONDS });

  const access = signAccessToken(user.id);
  const newRefresh = signRefreshToken(user.id);

  return {
    accessToken: access.token,
    refreshToken: newRefresh.token,
    accessExpiresIn: env.JWT_ACCESS_TTL_SECONDS,
    refreshExpiresIn: env.JWT_REFRESH_TTL_SECONDS,
  };
}

export async function getMe(userId: string) {
  return userModel.findUserById(userId);
}

export async function updateProfile(
  userId: string,
  patch: { displayName?: string; currentPassword?: string; newPassword?: string },
) {
  const user = await userModel.findUserPasswordHash(userId);
  if (!user) throw Object.assign(new Error("user_not_found"), { statusCode: 404 });

  const fields: { displayName?: string; passwordHash?: string } = {};

  if (patch.displayName !== undefined) {
    fields.displayName = patch.displayName;
  }

  if (patch.newPassword !== undefined) {
    if (!patch.currentPassword) {
      throw Object.assign(new Error("current_password_required"), { statusCode: 400 });
    }
    const ok = await bcrypt.compare(patch.currentPassword, user.password_hash);
    if (!ok) throw Object.assign(new Error("wrong_current_password"), { statusCode: 401 });
    fields.passwordHash = await bcrypt.hash(patch.newPassword, 10);
  }

  const updated = await userModel.updateUserProfile(userId, fields);
  if (!updated) throw Object.assign(new Error("nothing_to_update"), { statusCode: 400 });
  return updated;
}

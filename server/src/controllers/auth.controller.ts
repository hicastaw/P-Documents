import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as service from "../services/auth.service";

const RegisterBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(2).max(50),
});

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const body = RegisterBodySchema.parse(req.body);
    const user = await service.register(body.email, body.password, body.displayName);
    return res.status(201).json({ user });
  } catch (err) {
    if (err instanceof Error && (err as any).statusCode === 409) {
      return res.status(409).json({ error: "email_exists" });
    }
    next(err);
  }
}

const LoginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const body = LoginBodySchema.parse(req.body);
    const result = await service.login(body.email, body.password);
    return res.json(result);
  } catch (err) {
    if (err instanceof Error && (err as any).statusCode === 401) {
      return res.status(401).json({ error: "invalid_credentials" });
    }
    next(err);
  }
}

export async function logout(req: Request, res: Response) {
  await service.logout(req.auth!.jti, req.body?.refreshToken);
  return res.json({ ok: true });
}

const RefreshBodySchema = z.object({
  refreshToken: z.string().min(1),
});

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const body = RefreshBodySchema.parse(req.body);
    const result = await service.refresh(body.refreshToken);
    return res.json(result);
  } catch (err) {
    if (err instanceof Error && typeof (err as any).statusCode === "number") {
      return res.status((err as any).statusCode).json({ error: err.message });
    }
    next(err);
  }
}

export async function getMe(req: Request, res: Response) {
  const user = await service.getMe(req.auth!.userId);
  if (!user) return res.status(401).json({ error: "user_not_found" });
  return res.json({ user });
}

const UpdateProfileBodySchema = z.object({
  displayName: z.string().min(2).max(50).optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8).optional(),
});

export async function updateProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const body = UpdateProfileBodySchema.parse(req.body);
    const user = await service.updateProfile(req.auth!.userId, body);
    return res.json({ user });
  } catch (err) {
    if (err instanceof Error && typeof (err as any).statusCode === "number") {
      return res.status((err as any).statusCode).json({ error: err.message });
    }
    next(err);
  }
}

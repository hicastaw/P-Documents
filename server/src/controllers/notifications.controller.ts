import type { Request, Response } from "express";
import { z } from "zod";
import * as service from "../services/notifications.service";

export async function listNotifications(req: Request, res: Response) {
  const data = await service.listNotifications(req.auth!.userId);
  return res.json(data);
}

export async function markRead(req: Request, res: Response) {
  const id = z.string().uuid().parse(req.params.id);
  await service.markRead(id, req.auth!.userId);
  return res.json({ ok: true });
}

export async function markAllRead(req: Request, res: Response) {
  await service.markAllRead(req.auth!.userId);
  return res.json({ ok: true });
}

import type { Request, Response } from "express";
import * as service from "../services/stats.service";

export async function getPublicStats(req: Request, res: Response) {
  const stats = await service.getPublicStats();
  return res.json(stats);
}

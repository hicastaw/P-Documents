/**
 * controller.ts — HTTP layer for the admin module.
 *
 * Function -> thesis control-class mapping (Chuong3_ok.md 3.1.3):
 *   getDashboardStats                        -> AdminStatController
 *   listUsers, deleteUser, changeRole         -> AdminUserController
 *   listReports, dismissReport, deleteDocumentAdmin -> AdminModerationController
 */
import type { Request, Response, NextFunction } from "express";
import * as service from "../services/admin.service";

export async function getDashboardStats(req: Request, res: Response, next: NextFunction) {
  try {
    const stats = await service.getDashboardStats();
    return res.json(stats);
  } catch (err) {
    next(err);
  }
}

export async function listReports(req: Request, res: Response, next: NextFunction) {
  try {
    const reports = await service.listReports();
    return res.json({ reports });
  } catch (err) {
    next(err);
  }
}

export async function dismissReport(req: Request, res: Response, next: NextFunction) {
  try {
    await service.dismissReport(req.params.id);
    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function deleteDocumentAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    await service.deleteDocumentAdmin(req.params.id);
    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function listUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const users = await service.listUsers();
    return res.json({ users });
  } catch (err) {
    next(err);
  }
}

export async function deleteUser(req: Request, res: Response, next: NextFunction) {
  try {
    await service.deleteUser(req.params.id);
    return res.json({ success: true });
  } catch (err) {
    if (err instanceof Error && err.message === "cannot_delete_system_admin") {
      return res.status(403).json({ error: "cannot_delete_system_admin" });
    }
    next(err);
  }
}

export async function changeRole(req: Request, res: Response, next: NextFunction) {
  try {
    const { role } = req.body;
    await service.changeRole(req.params.id, role);
    return res.json({ success: true, role });
  } catch (err) {
    if (err instanceof Error && err.message === "invalid_role") {
      return res.status(400).json({ error: "invalid_role" });
    }
    if (err instanceof Error && err.message === "cannot_modify_system_admin") {
      return res.status(403).json({ error: "cannot_modify_system_admin" });
    }
    next(err);
  }
}

import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import * as controller from "../controllers/notifications.controller";

export const notificationsRouter = Router();

notificationsRouter.get("/", requireAuth, controller.listNotifications);
notificationsRouter.patch("/:id/read", requireAuth, controller.markRead);
notificationsRouter.patch("/read-all", requireAuth, controller.markAllRead);

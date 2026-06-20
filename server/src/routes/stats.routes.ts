import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import * as controller from "../controllers/stats.controller";

export const statsRouter = Router();

statsRouter.get("/", requireAuth, controller.getPublicStats);

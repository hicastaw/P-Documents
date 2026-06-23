import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import * as controller from "../controllers/auth.controller";

export const authRouter = Router();

authRouter.post("/register", controller.register);
authRouter.post("/login", controller.login);
authRouter.post("/refresh", controller.refresh);
authRouter.post("/logout", requireAuth, controller.logout);
authRouter.get("/me", requireAuth, controller.getMe);
authRouter.patch("/profile", requireAuth, controller.updateProfile);

import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import * as controller from "../controllers/forum.controller";

export const forumRouter = Router();

forumRouter.get("/threads", requireAuth, controller.listThreads);
forumRouter.post("/threads", requireAuth, controller.createThread);
forumRouter.get("/threads/:id", requireAuth, controller.getThread);
forumRouter.post("/threads/:id/posts", requireAuth, controller.postComment);
forumRouter.delete("/posts/:id", requireAuth, controller.deletePost);

import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import * as controller from "../controllers/documents.controller";

export const documentsRouter = Router();

documentsRouter.post("/presign", requireAuth, controller.requestPresignedUrl);
documentsRouter.post("/complete", requireAuth, controller.confirmUpload);
documentsRouter.get("/", requireAuth, controller.searchDocuments);
documentsRouter.get("/:id/download", requireAuth, controller.downloadDocument);
documentsRouter.post("/:id/star", requireAuth, controller.toggleStar);
documentsRouter.post("/:id/report", requireAuth, controller.submitReport);

import { Router } from "express";
import { requireAdmin } from "../middlewares/auth.middleware";
import * as controller from "../controllers/admin.controller";

export const adminRouter = Router();

adminRouter.use(requireAdmin);

adminRouter.get("/stats", controller.getDashboardStats);
adminRouter.get("/reports", controller.listReports);
adminRouter.post("/reports/:id/dismiss", controller.dismissReport);
adminRouter.delete("/documents/:id", controller.deleteDocumentAdmin);
adminRouter.get("/users", controller.listUsers);
adminRouter.delete("/users/:id", controller.deleteUser);
adminRouter.patch("/users/:id/role", controller.changeRole);

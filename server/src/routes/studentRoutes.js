import { Router } from "express";
import { createRequireAuth, requireRoles } from "../middleware/authMiddleware.js";
import { createStudentController } from "../controllers/studentController.js";

export function createStudentRoutes(User, Record, Registration, secret) {
  const router = Router();
  const controller = createStudentController(Record, Registration);
  router.use((_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
  router.use(createRequireAuth(User, secret), requireRoles("student"));
  router.get("/dashboard", controller.dashboard);
  return router;
}


import { Router } from "express";
import { createAdminController } from "../controllers/adminController.js";
import {
  createRequireAuth,
  requireRoles,
} from "../middleware/authMiddleware.js";

export function createAdminRoutes(User, Course, Offering, secret) {
  const router = Router();
  const controller = createAdminController(User, Course, Offering);

  router.use(createRequireAuth(User, secret));
  router.use(requireRoles("admin"));

  router.get("/users", controller.listUsers);
  router.get("/sections", controller.listSections);
  router.get("/courses", controller.listCourses);
  router.post("/users", controller.createUser);
  router.patch("/users/:id", controller.updateUser);

  return router;
}
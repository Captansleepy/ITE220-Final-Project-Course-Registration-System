import { createRegistrationController } from "../controllers/registrationController.js";
import { Router } from "express";
import { createAdvisorController } from "../controllers/advisorController.js";
import { createRequireAuth, requireRoles } from "../middleware/authMiddleware.js";

export function createAdvisorRoutes(User, Record, secret, registrationModels) {
  const router = Router();
  const controller = createAdvisorController(User, Record);
  router.use((_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
  router.use(createRequireAuth(User, secret), requireRoles("advisor"));
  router.get("/students", controller.listStudents);
  router.get("/students/:id/history", controller.history);
  if (registrationModels) {
    const registration = createRegistrationController({ User, Record, ...registrationModels });
    router.patch("/offerings/:offeringId/add-drop", registration.window);
    router.get("/students/:id/registrations", registration.list);
    router.get("/students/:id/offerings", registration.offerings);
    router.post("/students/:id/registrations", registration.register);
    router.delete("/students/:id/registrations/:registrationId", registration.drop);
  }
  return router;
}

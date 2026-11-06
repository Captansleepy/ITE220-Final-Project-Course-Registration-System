import { createRequestController } from "../controllers/requestController.js";
import { Router } from "express";
import { createRequireAuth, requireRoles } from "../middleware/authMiddleware.js";
import { createStudentController } from "../controllers/studentController.js";

export function createStudentRoutes(User, Record, Registration, secret, requestModels) {
  const router = Router();
  const controller = createStudentController(Record, Registration, User);
  router.use((_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
  router.use(createRequireAuth(User, secret), requireRoles("student"));
  router.get("/dashboard", controller.dashboard);
  if (requestModels) {
    const requests = createRequestController({User, Record, Registration, ...requestModels});
    router.get('/request-offerings', requests.options);
    router.get('/requests', requests.list);
    router.post('/requests', requests.submit);
    router.post('/requests/:requestId/cancel', requests.cancel);
  }
  return router;
}

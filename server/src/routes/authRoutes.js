import { Router } from 'express';
import { createAuthController } from '../controllers/authController.js';
import { createRequireAuth } from '../middleware/authMiddleware.js';
import { requireJwtSecret } from '../utils/auth.js';

export function createAuthRoutes(User, secret) {
  requireJwtSecret(secret);
  const router = Router();
  const controller = createAuthController(User, secret);
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.post('/login', controller.login);
  router.get('/me', createRequireAuth(User, secret), controller.me);
  return router;
}

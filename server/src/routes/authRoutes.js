import { Router } from 'express';
import { createAuthController } from '../controllers/authController.js';
import { createPasswordResetController } from '../controllers/passwordResetController.js';
import { createRequireAuth } from '../middleware/authMiddleware.js';
import { requireJwtSecret } from '../utils/auth.js';
import { createLimiter, limitByIp } from '../utils/rateLimit.js';

// reset (optional): { PasswordResetToken, mailer, appUrl } turns on password recovery.
export function createAuthRoutes(User, secret, reset) {
  requireJwtSecret(secret);
  const router = Router();
  const controller = createAuthController(User, secret);
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.post('/login', controller.login);
  router.get('/me', createRequireAuth(User, secret), controller.me);

  if (reset) {
    const recovery = createPasswordResetController({ User, ...reset });
    const FIFTEEN_MINUTES = 15 * 60 * 1000;
    // Per computer (IP address): 5 link requests and 10 reset attempts per 15 minutes.
    const requestLimit = limitByIp(createLimiter({ windowMs: FIFTEEN_MINUTES, max: 5 }),
      'Too many reset requests. Please wait a few minutes and try again.');
    const resetLimit = limitByIp(createLimiter({ windowMs: FIFTEEN_MINUTES, max: 10 }),
      'Too many attempts. Please wait a few minutes and try again.');
    router.post('/forgot-password', requestLimit, recovery.forgotPassword);
    router.post('/reset-password', resetLimit, recovery.resetPassword);
    router.recovery = recovery; // lets tests wait for background email work
  }
  return router;
}

import bcrypt from 'bcryptjs';
import { ROLES, createToken, publicUser, authError } from '../utils/auth.js';

// Accept the model as an argument so this can be tested before User.js exists.
export function createAuthController(User, secret) {
  return {
    async login(req, res) {
      const { email, password } = req.body || {};
      if (typeof email !== 'string' || typeof password !== 'string' ||
          email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
          !password.length || Buffer.byteLength(password, 'utf8') > 72) {
        return authError(res, 400, 'VALIDATION_ERROR', 'Enter a valid email and password.');
      }
      const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+passwordHash');
      if (!user || user.active !== true || !ROLES.includes(user.role) ||
          typeof user.passwordHash !== 'string' || !await bcrypt.compare(password, user.passwordHash)) {
        return authError(res, 401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
      }
      return res.json({ token: createToken(user, secret), user: publicUser(user) });
    },
    me(req, res) {
      return res.json({ user: publicUser(req.user) });
    },
  };
}

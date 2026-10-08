import { ROLES, verifyToken, authError } from '../utils/auth.js';

export function createRequireAuth(User, secret) {
  return async function requireAuth(req, res, next) {
    const match = /^Bearer ([^\s]+)$/i.exec(req.get('Authorization') || '');
    if (!match) return authError(res, 401, 'UNAUTHORIZED', 'Sign in to continue.');
    let payload;
    try { payload = verifyToken(match[1], secret); }
    catch { return authError(res, 401, 'UNAUTHORIZED', 'Your session is invalid or expired.'); }

    // Re-read the user so deactivation and role changes take effect immediately.
    const user = await User.findById(payload.sub).select('-passwordHash');
    if (!user || user.active !== true || !ROLES.includes(user.role)) {
      return authError(res, 401, 'UNAUTHORIZED', 'Sign in to continue.');
    }
    req.user = user;
    next();
  };
}

export function requireRoles(...roles) {
  if (!roles.length || roles.some(role => !ROLES.includes(role))) {
    throw new Error('requireRoles needs at least one valid role.');
  }
  return (req, res, next) => {
    if (!req.user) return authError(res, 401, 'UNAUTHORIZED', 'Sign in to continue.');
    if (!roles.includes(req.user.role)) return authError(res, 403, 'FORBIDDEN', 'You do not have permission to access this resource.');
    next();
  };
}

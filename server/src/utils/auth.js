import jwt from 'jsonwebtoken';

export const ROLES = ['admin', 'advisor', 'student'];
const issuer = 'course-registration-api';
const audience = 'course-registration-client';

export function requireJwtSecret(secret) {
  if (typeof secret !== 'string' || secret.length < 32) {
    throw new Error('JWT_SECRET must contain at least 32 characters.');
  }
  return secret;
}

export function createToken(user, secret) {
  return jwt.sign({}, secret, {
    algorithm: 'HS256', subject: String(user._id),
    issuer, audience, expiresIn: '1h',
  });
}

export function verifyToken(token, secret) {
  const payload = jwt.verify(token, secret, {
    algorithms: ['HS256'], issuer, audience,
  });
  if (typeof payload !== 'object' || !/^[a-f0-9]{24}$/i.test(payload.sub || '') || !Number.isInteger(payload.exp)) {
    throw new Error('Invalid token subject or expiration.');
  }
  return payload;
}

// An explicit list prevents passwordHash and future private fields leaking.
export function publicUser(user) {
  return {
    id: String(user._id), name: user.name, email: user.email,
    role: user.role, studentId: user.studentId ?? null,
    advisor: user.advisor ? String(user.advisor) : null,
  };
}

export function authError(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

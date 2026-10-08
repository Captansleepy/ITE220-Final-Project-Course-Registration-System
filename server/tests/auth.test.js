import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createAuthRoutes } from '../src/routes/authRoutes.js';
import { createRequireAuth, requireRoles } from '../src/middleware/authMiddleware.js';

const secret = 'test-only-secret-with-at-least-32-characters';
const id = '0123456789abcdef01234567';
const passwordHash = await bcrypt.hash('DemoPassword2026!', 4);
async function fixture(t) {
  const state = { user: { _id: id, name: 'Demo Student', email: 'demo@example.test', role: 'student', studentId: 'STU001', active: true, passwordHash } };
  const User = {
    findOne(filter) { return { select: async () => filter.email === state.user?.email ? state.user : null }; },
    findById(value) { return { select: async () => value === state.user?._id ? state.user : null }; },
  };
  const app = express(); app.use(express.json());
  app.use('/api/auth', createAuthRoutes(User, secret));
  app.get('/admin-only', createRequireAuth(User, secret), requireRoles('admin'), (_req, res) => res.json({ ok: true }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (route, token) => fetch(base + route, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  const login = (body = { email: ' DEMO@example.test ', password: 'DemoPassword2026!' }) => fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { state, request, login };
}

test('login for all roles; normalized email; public fields only', async t => {
  const f = await fixture(t);
  for (const role of ['student', 'advisor', 'admin']) {
    f.state.user.role = role;
    const response = await f.login(); assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const data = await response.json(); assert.equal(data.user.role, role);
    assert.equal('passwordHash' in data.user, false);
    const payload = jwt.verify(data.token, secret, { algorithms: ['HS256'], issuer: 'course-registration-api', audience: 'course-registration-client' });
    assert.equal(payload.sub, id); assert.equal(payload.exp - payload.iat, 3600);
    const me = await f.request('/api/auth/me', data.token);
    assert.equal(me.status, 200); assert.equal('passwordHash' in (await me.json()).user, false);
  }
});
test('reject malformed login and object injection', async t => {
  const f = await fixture(t);
  for (const body of [{}, { email: { $ne: null }, password: 'x' }, { email: 'demo@example.test', password: 'x'.repeat(73) }]) {
    assert.equal((await f.login(body)).status, 400);
  }
});
test('wrong password, missing user, inactive user use same response', async t => {
  const f = await fixture(t);
  const wrong = await f.login({ email: 'demo@example.test', password: 'incorrect' });
  const missing = await f.login({ email: 'missing@example.test', password: 'incorrect' });
  f.state.user.active = false; const inactive = await f.login();
  assert.equal(wrong.status, 401); assert.equal(missing.status, 401); assert.equal(inactive.status, 401);
  assert.deepEqual(await wrong.json(), await missing.json());
});
test('reject missing, forged, expired and wrongly targeted tokens', async t => {
  const f = await fixture(t);
  const options = { subject: id, issuer: 'course-registration-api', audience: 'course-registration-client', expiresIn: '1h' };
  const tokens = [undefined, 'invalid', jwt.sign({}, 'another-secret', options), jwt.sign({}, secret, { ...options, expiresIn: -1 }), jwt.sign({}, secret, { ...options, audience: 'wrong-app' }), jwt.sign({}, secret, { ...options, subject: 'not-an-id' })];
  for (const token of tokens) assert.equal((await f.request('/api/auth/me', token)).status, 401);
});
test('role restrictions and deactivation apply to existing tokens', async t => {
  const f = await fixture(t); const { token } = await (await f.login()).json();
  assert.equal((await f.request('/admin-only', token)).status, 403);
  f.state.user.role = 'admin'; assert.equal((await f.request('/admin-only', token)).status, 200);
  f.state.user.active = false; assert.equal((await f.request('/api/auth/me', token)).status, 401);
  f.state.user = null; assert.equal((await f.request('/api/auth/me', token)).status, 401);
});
test('missing or short secret fails setup', () => {
  assert.throws(() => createAuthRoutes({}, undefined));
  assert.throws(() => createAuthRoutes({}, 'short'));
});

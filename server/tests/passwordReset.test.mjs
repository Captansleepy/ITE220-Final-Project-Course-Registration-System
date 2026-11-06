import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import bcrypt from 'bcryptjs';
import { createAuthRoutes } from '../src/routes/authRoutes.js';
import { hashToken } from '../src/controllers/passwordResetController.js';
import { createMailer } from '../src/utils/mailer.js';

const secret = 'test-only-secret-with-at-least-32-characters';
const OLD = 'OldPassword2026!', NEW = 'NewPassword2026!';
const oldHash = await bcrypt.hash(OLD, 4);

// A fake query result that works with both "await" and ".select()".
const q = value => ({ select() { return this; }, then(ok, fail) { return Promise.resolve(value).then(ok, fail); } });

async function fixture(t) {
  const users = [
    { _id: 'a'.repeat(24), name: 'Active Student', email: 'active@example.test', role: 'student', active: true, passwordHash: oldHash, sessionVersion: 0 },
    { _id: 'b'.repeat(24), name: 'Inactive Student', email: 'inactive@example.test', role: 'student', active: false, passwordHash: oldHash, sessionVersion: 0 },
  ];
  const tokens = [];
  const emails = [];
  const User = {
    findOne: f => q(users.find(u => u.email === f.email) ?? null),
    findById: id => q(users.find(u => u._id === id) ?? null),
    async updateOne(f, u) {
      const user = users.find(x => x._id === String(f._id) && x.active === f.active);
      if (!user) return { modifiedCount: 0 };
      Object.assign(user, u.$set); user.sessionVersion += u.$inc.sessionVersion;
      return { modifiedCount: 1 };
    },
  };
  const PasswordResetToken = {
    async deleteMany(f) {
      for (let i = tokens.length - 1; i >= 0; i--) if (tokens[i].user === f.user && tokens[i].usedAt === null) tokens.splice(i, 1);
    },
    async create(doc) { tokens.push({ ...doc, usedAt: null }); },
    // Checks and marks the row in one synchronous step, like MongoDB does.
    async findOneAndUpdate(f, u) {
      const row = tokens.find(r => r.tokenHash === f.tokenHash && r.usedAt === null && r.expiresAt > f.expiresAt.$gt);
      if (!row) return null;
      Object.assign(row, u.$set); return row;
    },
  };
  const mailer = { async send(email) { emails.push(email); } };
  const routes = createAuthRoutes(User, secret, { PasswordResetToken, mailer, appUrl: 'http://localhost:5174' });
  const app = express(); app.use(express.json()); app.use('/api/auth', routes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  t.after(() => new Promise(r => { server.close(r); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}/api/auth`;
  const post = async (path, body) => {
    const res = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: res.status, body: await res.json(), headers: res.headers };
  };
  const forgot = async email => { const r = await post('/forgot-password', { email }); await routes.recovery.whenIdle(); return r; };
  const tokenFrom = email => /#token=([a-f0-9]{64})$/m.exec(email.text)[1];
  const me = token => fetch(base + '/me', { headers: { Authorization: `Bearer ${token}` } });
  return { users, tokens, emails, post, forgot, tokenFrom, me };
}

test('same reply for registered, unknown and inactive emails; only active accounts get a link', async t => {
  const f = await fixture(t);
  const replies = [await f.forgot(' ACTIVE@example.test '), await f.forgot('nobody@example.test'), await f.forgot('inactive@example.test')];
  for (const r of replies) assert.equal(r.status, 202);
  assert.deepEqual(replies[0].body, replies[1].body);
  assert.deepEqual(replies[0].body, replies[2].body);
  assert.equal(f.emails.length, 1);
  assert.equal(f.emails[0].to, 'active@example.test');
  // The database keeps only a hash, never the token from the email.
  const token = f.tokenFrom(f.emails[0]);
  assert.equal(f.tokens.length, 1);
  assert.equal(f.tokens[0].tokenHash, hashToken(token));
  assert.equal(JSON.stringify(f.tokens).includes(token), false);
  assert.match(f.emails[0].text, /http:\/\/localhost:5174\/reset-password#token=/);
});

test('reject malformed input', async t => {
  const f = await fixture(t);
  // Four cases only: the limit is five requests per computer per 15 minutes.
  for (const email of [undefined, 'not-an-email', { $ne: null }, 'x'.repeat(250) + '@a.test']) {
    assert.equal((await f.post('/forgot-password', { email })).status, 400);
  }
  for (const token of [undefined, 'short', 'z'.repeat(64), { $ne: null }]) {
    assert.equal((await f.post('/reset-password', { token, password: NEW })).body.error.code, 'INVALID_RESET_LINK');
  }
  await f.forgot('active@example.test');
  const token = f.tokenFrom(f.emails[0]);
  for (const password of [undefined, 'short', 'x'.repeat(73)]) {
    assert.equal((await f.post('/reset-password', { token, password })).body.error.code, 'VALIDATION_ERROR');
  }
  // A rejected password does not use up the link.
  assert.equal((await f.post('/reset-password', { token, password: NEW })).status, 200);
});

test('reset changes the password, ends old sessions and the link works only once', async t => {
  const f = await fixture(t);
  const login = p => f.post('/login', { email: 'active@example.test', password: p });
  const before = await login(OLD); assert.equal(before.status, 200);
  await f.forgot('active@example.test');
  const token = f.tokenFrom(f.emails[0]);
  const reset = await f.post('/reset-password', { token, password: NEW });
  assert.equal(reset.status, 200);
  assert.equal((await f.me(before.body.token)).status, 401, 'old session ended');
  assert.equal((await login(OLD)).status, 401, 'old password refused');
  const after = await login(NEW); assert.equal(after.status, 200, 'new password works');
  assert.equal((await f.me(after.body.token)).status, 200);
  assert.equal((await bcrypt.compare(NEW, f.users[0].passwordHash)), true);
  assert.equal((await f.post('/reset-password', { token, password: 'Another2026!' })).body.error.code, 'INVALID_RESET_LINK', 'link reused');
});

test('expired links do not work', async t => {
  const f = await fixture(t);
  await f.forgot('active@example.test');
  f.tokens[0].expiresAt = new Date(Date.now() - 1000);
  assert.equal((await f.post('/reset-password', { token: f.tokenFrom(f.emails[0]), password: NEW })).status, 400);
  assert.equal(f.users[0].passwordHash, oldHash);
});

test('a newer request cancels the older link', async t => {
  const f = await fixture(t);
  await f.forgot('active@example.test');
  await f.forgot('active@example.test');
  const [first, second] = f.emails.map(f.tokenFrom);
  assert.equal(f.tokens.length, 1);
  assert.equal((await f.post('/reset-password', { token: first, password: NEW })).status, 400);
  assert.equal((await f.post('/reset-password', { token: second, password: NEW })).status, 200);
});

test('two resets with the same link at once: only one succeeds', async t => {
  const f = await fixture(t);
  await f.forgot('active@example.test');
  const token = f.tokenFrom(f.emails[0]);
  const results = await Promise.all([
    f.post('/reset-password', { token, password: 'FirstChoice2026!' }),
    f.post('/reset-password', { token, password: 'SecondChoice2026!' }),
  ]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 400]);
  assert.equal(f.users[0].sessionVersion, 1);
});

test('an account deactivated after the request cannot be reset', async t => {
  const f = await fixture(t);
  await f.forgot('active@example.test');
  f.users[0].active = false;
  assert.equal((await f.post('/reset-password', { token: f.tokenFrom(f.emails[0]), password: NEW })).status, 400);
  assert.equal(f.users[0].passwordHash, oldHash);
});

test('rate limits: per email (silent) and per computer (429)', async t => {
  const f = await fixture(t);
  for (let i = 0; i < 4; i++) assert.equal((await f.forgot('active@example.test')).status, 202);
  assert.equal(f.emails.length, 3, 'fourth email in an hour is not sent');
  assert.equal((await f.forgot('other@example.test')).status, 202);
  const blocked = await f.post('/forgot-password', { email: 'other@example.test' });
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get('retry-after')) > 0);
  for (let i = 0; i < 10; i++) await f.post('/reset-password', { token: 'a'.repeat(64), password: NEW });
  assert.equal((await f.post('/reset-password', { token: 'a'.repeat(64), password: NEW })).status, 429);
});

test('mailer: test transports refused in production; unknown transport refused', () => {
  const saved = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    assert.throws(() => createMailer('console'));
    assert.throws(() => createMailer('memory'));
    assert.equal(createMailer(undefined).name, 'disabled');
  } finally { process.env.NODE_ENV = saved; }
  assert.equal(createMailer('console').name, 'console');
  assert.throws(() => createMailer('smtp-not-configured'));
});

test('without reset settings the recovery routes do not exist (older setup still works)', async () => {
  const router = createAuthRoutes({}, secret);
  const paths = router.stack.filter(l => l.route).map(l => l.route.path);
  assert.deepEqual(paths, ['/login', '/me']);
});

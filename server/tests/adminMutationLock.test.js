import test from 'node:test';
import assert from 'node:assert/strict';
import { withAdminMutationLock, assertAdminRemovalAllowed } from '../src/utils/adminMutationLock.js';

// This harness verifies shared-session sequencing and last-admin rules.
// Actual MongoDB write-conflict retry still requires replica-set integration.
function fixture() {
  const accounts = [{ role: 'admin', active: true }, { role: 'admin', active: true }];
  let tail = Promise.resolve();
  const session = {};
  const writes = [];
  const connection = {
    db: { collection(name) {
      assert.equal(name, 'admin_mutation_guards');
      return { async updateOne(filter, update, options) {
        assert.equal(filter._id, 'admin-accounts');
        writes.push({ update, options });
        return { matchedCount: 1 };
      } };
    } },
    transaction(callback) {
      const pending = tail.then(() => callback(session));
      tail = pending.catch(() => {});
      return pending;
    },
  };
  const User = { countDocuments(filter) {
    assert.deepEqual(filter, { role: 'admin', active: true });
    return { session(actual) {
      assert.equal(actual, session);
      return Promise.resolve(accounts.filter(a => a.role === 'admin' && a.active).length);
    } };
  } };
  return { accounts, session, connection, User, writes };
}

for (const operation of ['deactivation', 'demotion']) {
  test(`shared guard prevents two simultaneous admin ${operation}s in serialized harness`, async () => {
    const f = fixture();
    const results = await Promise.allSettled(f.accounts.map(account =>
      withAdminMutationLock(async session => {
        const next = operation === 'deactivation'
          ? { role: 'admin', active: false } : { role: 'advisor', active: true };
        await assertAdminRemovalAllowed(f.User, account, next, session);
        Object.assign(account, next);
      }, f.connection)
    ));
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(results.find(r => r.status === 'rejected').reason.code, 'LAST_ADMIN');
    assert.equal(f.accounts.filter(a => a.role === 'admin' && a.active).length, 1);
    const locks = f.writes.filter(w => w.update.$inc);
    assert.equal(locks.length, 2);
    assert.ok(locks.every(w => w.options.session === f.session));
  });
}

test('retaining admin status, inactive admins and non-admins do not require removal count', async () => {
  const User = { countDocuments() { throw Error('Unexpected count'); } };
  for (const [user, next] of [
    [{ role: 'admin', active: true }, { role: 'admin', active: true }],
    [{ role: 'admin', active: false }, { role: 'advisor', active: false }],
    [{ role: 'student', active: true }, { role: 'student', active: false }],
  ]) await assertAdminRemovalAllowed(User, user, next, {});
});

test('missing guard refuses to execute an account mutation', async () => {
  let called = false;
  const connection = {
    db: { collection: () => ({ updateOne: async () => ({ matchedCount: 0 }) }) },
    transaction: callback => callback({}),
  };
  await assert.rejects(withAdminMutationLock(() => { called = true; }, connection), /guard is unavailable/);
  assert.equal(called, false);
});

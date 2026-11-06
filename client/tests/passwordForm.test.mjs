import test from 'node:test';
import assert from 'node:assert/strict';
import { checkEmail, checkNewPassword, readResetToken } from '../src/utils/passwordForm.js';

const token = 'ab'.repeat(32);

test('reads a valid token from the link and rejects broken ones', () => {
  assert.equal(readResetToken('#token=' + token), token);
  assert.equal(readResetToken('token=' + token), token);
  for (const hash of ['', '#', '#token=', '#token=short', '#token=' + 'Z'.repeat(64), '#other=' + token, undefined]) {
    assert.equal(readResetToken(hash), '');
  }
});

test('checks the email field', () => {
  assert.equal(checkEmail('  '), 'Email is required.');
  assert.equal(checkEmail('nope'), 'Enter a valid email address.');
  assert.equal(checkEmail(' student001@example.test '), '');
});

test('checks the new password and confirmation', () => {
  assert.deepEqual(checkNewPassword('', ''), { password: 'Enter a new password.', confirm: 'Type the new password again.' });
  assert.equal(checkNewPassword('short', 'short').password, 'Use at least 8 characters.');
  assert.match(checkNewPassword('x'.repeat(73), 'x'.repeat(73)).password, /too long/);
  // 24 Thai characters are 72 bytes (allowed); 25 are 75 bytes (too long).
  assert.deepEqual(checkNewPassword('ก'.repeat(24), 'ก'.repeat(24)), {});
  assert.match(checkNewPassword('ก'.repeat(25), 'ก'.repeat(25)).password, /too long/);
  assert.equal(checkNewPassword('GoodPassword1', 'GoodPassword2').confirm, 'The two passwords do not match.');
  assert.deepEqual(checkNewPassword('GoodPassword1', 'GoodPassword1'), {});
});

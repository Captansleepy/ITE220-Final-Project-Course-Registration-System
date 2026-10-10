// Opt-in live acceptance checks. Always create a new database; never use or delete the configured one.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';

const serverDir = fileURLToPath(new URL('../', import.meta.url));
// Keep the database name compact for Atlas compatibility.
const database = `course_registration_seed_${Date.now().toString(36)}${randomBytes(2).toString('hex')}`;
const password = randomBytes(24).toString('hex');
assert(process.env.MONGODB_URI, 'Configure MONGODB_URI in server/.env first.');
process.env.MONGODB_DB_NAME = database;
process.env.SEED_PASSWORD = password;
process.env.JWT_SECRET = randomBytes(32).toString('hex');
let server;
let checks = 0;
const check = label => { checks++; console.log(`PASS ${label}`); };

try {
  console.log(`Isolated acceptance database: ${database}`);
  execFileSync(process.execPath, ['seed.cjs', '--apply'], { cwd: serverDir, env: process.env, stdio: 'inherit' });
  const { default: connectDB } = await import('../src/config/db.js');
  await connectDB();
  const { default: app } = await import('../src/app.js');
  const { default: User } = await import('../src/models/User.js');
  const { default: Course } = await import('../src/models/Course.js');
  const { default: Term } = await import('../src/models/Term.js');
  const { default: Record } = await import('../src/models/Record.js');
  const { default: Registration } = await import('../src/models/Registration.js');
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function request(route, token, method = 'GET', body, expected = 200) {
    const response = await fetch(base + route, { method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await response.json();
    assert((Array.isArray(expected) ? expected : [expected]).includes(response.status),
      `${method} ${route}: status ${response.status}, ${data.error?.code ?? 'unexpected status'}`);
    return data;
  }
  async function login(email) { return request('/auth/login', null, 'POST', { email, password }); }
  assert.equal(await User.countDocuments({ role: 'student' }), 25);
  assert.equal(await User.countDocuments({ role: 'advisor' }), 2);
  assert.equal(await User.countDocuments({ role: 'admin' }), 1);
  for (const u of await User.find({ role: 'student' }).lean()) {
    assert(await User.exists({ _id: u.advisor, role: 'advisor' }));
  }
  for (const collection of ['records', 'offerings', 'registrations']) {
    const refs = collection === 'records' ? [['student', 'users'], ['course', 'courses'], ['term', 'terms']]
      : collection === 'offerings' ? [['course', 'courses'], ['term', 'terms']]
      : [['student', 'users'], ['offering', 'offerings']];
    for (const [field, target] of refs) {
      const broken = await mongoose.connection.db.collection(collection).aggregate([
        { $lookup: { from: target, localField: field, foreignField: '_id', as: 'reference' } },
        { $match: { reference: { $size: 0 } } }, { $count: 'count' },
      ]).toArray();
      assert.equal(broken.length, 0, `${collection}.${field} has broken references`);
    }
  }
  check('Fresh seed: 25 students, advisor assignments and all academic references valid');
  const admin = await login('admin@example.test');
  const advisor = await login('advisor001@example.test');
  const seededStudent = await login('student001@example.test');
  for (const [account, route] of [[admin, '/admin/users'], [advisor, '/advisor/students'], [seededStudent, '/student/dashboard']]) {
    await request(route, account.token);
    await request('/auth/me', account.token);
    await request(route, null, 'GET', undefined, 401);
  }
  await request('/admin/users', seededStudent.token, 'GET', undefined, 403);
  await request('/advisor/students', seededStudent.token, 'GET', undefined, 403);
  await request('/student/dashboard', advisor.token, 'GET', undefined, 403);
  await request('/auth/login', null, 'POST', { email: 'student001@example.test', password: 'incorrect' }, 401);
  check('Real password login for all three roles; unauthenticated and wrong-role requests blocked');
  const createUser = (email, studentId) => request('/admin/users', admin.token, 'POST', {
    name: 'Acceptance Student', email, password, role: 'student', studentId, advisor: advisor.user.id,
  }, 201);
  const first = (await createUser('acceptance1@example.test', 'ACCEPT001')).user;
  const second = (await createUser('acceptance2@example.test', 'ACCEPT002')).user;
  await request(`/admin/users/${first.id}`, admin.token, 'PATCH', { name: 'Edited Acceptance Student' });
  assert.equal((await User.findById(first.id)).name, 'Edited Acceptance Student');
  check('Admin create/edit operations persist');
  const firstLogin = await login(first.email);
  const current = await Term.findOne({ isCurrent: true, isFinalised: false });
  const historical = await Term.findOne({ isCurrent: false });
  const courses = await Course.find({}).sort({ code: 1 }).limit(3);
  await Record.create([
    { student: first.id, course: courses[0]._id, term: historical._id, grade: 'F' },
    { student: first.id, course: courses[1]._id, term: historical._id, grade: 'B+' },
  ]);
  const offeringBody = course => ({ courseId: String(course._id), termId: String(current._id), section: 900,
    meetings: [{ day: 'Monday', startTime: '09:00', endTime: '13:00' }],
    room: 'Acceptance Room', instructor: 'Acceptance Instructor', capacity: 1,
  });
  const createOffering = body => request('/advisor/offerings', advisor.token, 'POST', body, 201);
  const retake = (await createOffering(offeringBody(courses[0]))).offering;
  const passed = (await createOffering({ ...offeringBody(courses[1]), room: 'Other Room', instructor: 'Other Instructor' })).offering;
  const clash = (await createOffering({ ...offeringBody(courses[2]), room: 'Third Room', instructor: 'Third Instructor' })).offering;
  await request(`/advisor/offerings/${retake.id}`, advisor.token, 'PATCH', { room: 'Edited Acceptance Room' });
  const studentPath = `/advisor/students/${first.id}`;
  const offerings = (await request(studentPath + '/offerings', advisor.token)).offerings;
  assert(offerings.find(o => o.id === retake.id).retakeRequired);
  assert(offerings.find(o => o.id === retake.id).eligible);
  assert.equal(offerings[0].retakeRequired, true);
  assert.equal(offerings.find(o => o.id === passed.id).code, 'ALREADY_PASSED');
  const dashboard = await request('/student/dashboard', firstLogin.token);
  assert.equal(dashboard.earnedCredits, 4);
  assert.equal(dashboard.outstandingFailures.length, 1);
  assert(dashboard.history.some(t => t.term === historical.code));
  check('Advisor offering create/edit; F retakes sorted first; passed course excluded; student credits/history');
  const register = (student, offeringId, status = 201) => request(`/advisor/students/${student}/registrations`, advisor.token, 'POST', { offeringId }, status);
  const registration = (await register(first.id, retake.id)).registration;
  assert.equal((await register(second.id, retake.id, 409)).error.code, 'OFFERING_FULL');
  assert.equal((await register(first.id, clash.id, 409)).error.code, 'TIMETABLE_CLASH');
  assert.equal((await register(first.id, passed.id, 409)).error.code, 'ALREADY_PASSED');
  const occupied = (await request('/advisor/offerings', advisor.token)).offerings.find(o => o.id === retake.id);
  assert.equal(occupied.seatsTaken, 1); assert.equal(occupied.seatsRemaining, 0);
  assert.equal(occupied.room, 'Edited Acceptance Room');
  await request(`/advisor/offerings/${retake.id}`, advisor.token, 'DELETE', undefined, 409);
  check('Real Atlas registration transaction; seat counts, full sections, clashes and passed-course blocks');
  const deadline = new Date(Date.now() + 86400000).toISOString();
  await request(`/advisor/offerings/${retake.id}/add-drop`, advisor.token, 'PATCH', { addDropOpen: true, addDropClosesAt: deadline });
  let view = await request('/student/dashboard', firstLogin.token);
  assert.equal(view.registrations[0].addDropOpen, true);
  assert.equal(view.registrations[0].addDropClosesAt, deadline);
  assert.equal(view.advisor.email, 'advisor001@example.test');
  assert.equal(await Registration.countDocuments({ student: first.id, status: 'registered' }), 1);
  await request(`/advisor/offerings/${retake.id}/add-drop`, advisor.token, 'PATCH', { addDropOpen: false });
  view = await request('/student/dashboard', firstLogin.token);
  assert.equal(view.registrations[0].addDropOpen, false);
  check('Add/Drop deadline/contact persist and appear in student dashboard; window changes do not change registration');
  await request(studentPath + `/registrations/${registration.id}`, advisor.token, 'DELETE');
  assert.equal((await request('/advisor/offerings', advisor.token)).offerings.find(o => o.id === retake.id).seatsRemaining, 1);
  const restored = (await register(first.id, retake.id)).registration;
  assert.equal(restored.id, registration.id);
  await Term.updateOne({ _id: current._id }, { $set: { isFinalised: true } });
  await request(studentPath + `/registrations/${registration.id}`, advisor.token, 'DELETE', undefined, 409);
  await Term.updateOne({ _id: current._id }, { $set: { isFinalised: false } });
  await request(`/advisor/offerings/${clash.id}`, advisor.token, 'DELETE');
  check('Drop frees seat; re-registration reuses history; finalised term blocks changes; unused offering deletion');
  const singleSeat = (await createOffering({ ...offeringBody(courses[2]), section: 901,
    meetings: [{ day: 'Tuesday', startTime: '09:00', endTime: '13:00' }],
  })).offering;
  const races = await Promise.all([first.id, second.id].map(id =>
    request(`/advisor/students/${id}/registrations`, advisor.token, 'POST', { offeringId: singleSeat.id }, [201, 409])));
  assert.equal(races.filter(r => r.registration).length, 1);
  assert.equal(races.filter(r => r.error?.code === 'OFFERING_FULL').length, 1);
  assert.equal(await Registration.countDocuments({ offering: singleSeat.id, status: 'registered' }), 1);
  check('Two simultaneous registrations compete for one seat; only one succeeds');
  await request(`/admin/users/${second.id}`, admin.token, 'DELETE');
  assert.equal((await User.findById(second.id)).active, false);
  await request('/auth/login', null, 'POST', { email: second.email, password }, 401);
  await request(`/admin/users/${admin.user.id}`, admin.token, 'DELETE', undefined, 400);
  check('Deactivation persists, inactive login rejected, admin self-deletion blocked');
  const extraAdmin = (await request('/admin/users', admin.token, 'POST', {
    name: 'Acceptance Admin', email: 'acceptance-admin@example.test', password, role: 'admin',
  }, 201)).user;
  const extraLogin = await login(extraAdmin.email);
  const removals = await Promise.all([
    request(`/admin/users/${extraAdmin.id}`, admin.token, 'DELETE', undefined, [200, 401, 409]),
    request(`/admin/users/${admin.user.id}`, extraLogin.token, 'DELETE', undefined, [200, 401, 409]),
  ]);
  assert.equal(removals.filter(r => r.deactivated).length, 1);
  assert.equal(await User.countDocuments({ role: 'admin', active: true }), 1);
  check('Two simultaneous admin deactivations cannot remove the last active admin');
  console.log(`Acceptance passed: ${checks} groups of live checks. Database retained for inspection: ${database}`);
} catch (error) {
  console.error('Acceptance failed:', error instanceof assert.AssertionError ? error.message : error.name);
  console.error(`Isolated database retained: ${database}`);
  process.exitCode = 1;
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect();
}

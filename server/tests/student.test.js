import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createStudentRoutes } from "../src/routes/studentRoutes.js";
import { buildStudentDashboard } from "../src/controllers/studentController.js";
import { createToken } from "../src/utils/auth.js";

const secret = "student-tests-only-secret-at-least-32-characters";
const first = "111111111111111111111111";
const second = "222222222222222222222222";
const student = { _id: first, name: "First", email: "first@example.test", studentId: "STU001", role: "student", active: true, passwordHash: "private" };
const course = (id) => ({ _id: id, code: id, title: `Course ${id}`, credits: 4 });
const record = (id, grade, term = "2025-1") => ({ _id: `${id}-${grade}-${term}`, course: course(id), grade, term: { code: term } });
function query(value) { return { populate() { return this; }, lean: async () => value }; }
async function fixture(t) {
  const users = { [first]: { ...student }, [second]: { ...student, _id: second, name: "Second", studentId: "STU002" } };
  const state = { reads: [], fail: false, advisor: null, advisorReads: [] };
  users[first].advisor = "333333333333333333333333";
  const User = {
    findById: id => ({ select: async () => users[id] }),
    findOne: filter => { state.advisorReads.push(filter); return { select() { return this; }, lean: async () => state.advisor }; },
  };
  const Record = { find(filter) {
    state.reads.push(["records", filter]);
    if (state.fail) throw new Error("Database unavailable");
    return query([record(filter.student === first ? "CSC220" : "ENG103", "A")]);
  } };
  const Registration = { find(filter) { state.reads.push(["registrations", filter]); return query([]); } };
  const app = express();
  app.use("/api/student", createStudentRoutes(User, Record, Registration, secret));
  app.use((_error, _req, res, _next) => res.status(500).json({ error: { message: "Unable to load data" } }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const request = (id = first, suffix = "") => fetch(`http://127.0.0.1:${server.address().port}/api/student/dashboard${suffix}`, {
    headers: id ? { Authorization: `Bearer ${createToken(users[id], secret)}` } : {},
  });
  return { users, state, request };
}

test("student token scopes both database queries; query parameters cannot select someone else", async t => {
  const { request, state } = await fixture(t);
  for (const [id, code] of [[first, "CSC220"], [second, "ENG103"]]) {
    const response = await request(id, `?student=${second}&studentId=STU002`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const data = await response.json();
    assert.equal(data.student.id, id);
    assert.equal(data.history[0].courses[0].courseCode, code);
    assert.equal("passwordHash" in data.student, false);
  }
  assert.deepEqual(state.reads, [
    ["records", { student: first }], ["registrations", { student: first, status: "registered" }],
    ["records", { student: second }], ["registrations", { student: second, status: "registered" }],
  ]);
});
test("missing tokens, other roles and inactive students cannot read dashboard", async t => {
  const { request, users, state } = await fixture(t);
  assert.equal((await request(null)).status, 401);
  for (const role of ["admin", "advisor"]) {
    users[first].role = role;
    assert.equal((await request()).status, 403);
  }
  users[first].role = "student";
  users[first].active = false;
  assert.equal((await request()).status, 401);
  assert.deepEqual(state.reads, []);
});
test("credits count each passed course once, including D and D+; failures clear after a pass", () => {
  const records = [record("A", "F"), record("A", "D", "2025-2"), record("A", "A", "2025-3"),
    record("B", "D+"), record("C", "F"), record("C", "F", "2025-2"), record("D", "W")];
  const data = buildStudentDashboard(student, records, []);
  assert.equal(data.earnedCredits, 8);
  assert.deepEqual(data.outstandingFailures.map(c => c.courseCode), ["C"]);
  assert.deepEqual(data.history.map(group => group.term), ["2025-3", "2025-2", "2025-1"]);
});
test("only registered offerings in current terms appear with real meeting times", () => {
  const make = (id, isCurrent, status) => ({ _id: id, status, offering: {
    course: course("CSC220"), term: { code: isCurrent ? "2026-1" : "2025-3", isCurrent },
    section: 1, room: "Room 301", meetings: [{ day: "Monday", startTime: "08:30", endTime: "12:30" }],
  } });
  const data = buildStudentDashboard(student, [], [make("current", true, "registered"), make("old", false, "registered"), make("dropped", true, "dropped")]);
  assert.equal(data.registrations.length, 1);
  assert.equal(data.registrations[0].id, "current");
  assert.deepEqual(data.registrations[0].meetings, [{ day: "Monday", time: "08:30 - 12:30", room: "Room 301" }]);
});
test("empty accounts return empty sections and zero earned credits", () => {
  const data = buildStudentDashboard(student, [], []);
  assert.equal(data.earnedCredits, 0);
  assert.deepEqual(data.history, []);
  assert.deepEqual(data.registrations, []);
  assert.deepEqual(data.outstandingFailures, []);
});
test("broken references and database errors do not turn into sample or empty success", async t => {
  assert.throws(() => buildStudentDashboard(student, [{ course: null }], []));
  assert.throws(() => buildStudentDashboard(student, [], [{ status: "registered", offering: null }]));
  const { request, state } = await fixture(t);
  state.fail = true;
  assert.equal((await request()).status, 500);
});

test("advisor contact is scoped to student's assignment and exposes only name and email", async t => {
  const { request, state } = await fixture(t);
  state.advisor = { name: "Assigned Advisor", email: "advisor@example.test", passwordHash: "secret", role: "advisor" };
  const response = await request(first, "?advisor=someone-else");
  const data = await response.json();
  assert.deepEqual(data.advisor, { name: "Assigned Advisor", email: "advisor@example.test" });
  assert.deepEqual(state.advisorReads, [{ _id: "333333333333333333333333", role: "advisor", active: true }]);
  state.advisor = null;
  assert.equal((await (await request()).json()).advisor, null);
});
test("student add/drop status uses stored flag, closing date and term finalisation", () => {
  const registration = (changes = {}, termChanges = {}) => ({ _id: "registration", status: "registered", offering: {
    course: course("CSC220"), term: { code: "2026-1", isCurrent: true, ...termChanges },
    section: 1, room: "A", instructor: "Teacher", meetings: [], addDropOpen: true, ...changes,
  } });
  const view = r => buildStudentDashboard(student, [], [r]).registrations[0];
  assert.equal(view(registration()).addDropOpen, true);
  assert.equal(view(registration()).addDropClosesAt, null);
  assert.equal(view(registration({ addDropOpen: false })).addDropOpen, false);
  assert.equal(view(registration({ addDropClosesAt: new Date("2000-01-01") })).addDropOpen, false);
  assert.equal(view(registration({}, { isFinalised: true })).addDropOpen, false);
  const future = view(registration({ addDropClosesAt: new Date("2099-01-01") }));
  assert.equal(future.addDropOpen, true);
  assert.equal(future.instructor, "Teacher");
});

import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createAdvisorRoutes } from "../src/routes/advisorRoutes.js";
import { createToken } from "../src/utils/auth.js";

const secret = "advisor-tests-only-secret-at-least-32-characters";
const advisorId = "111111111111111111111111";
const otherId = "222222222222222222222222";
const firstId = "333333333333333333333333";
const secondId = "444444444444444444444444";
const outsiderId = "555555555555555555555555";
const students = [
  { _id: firstId, studentId: "STU001", name: "First", email: "first@example.test", role: "student", advisor: advisorId, active: true },
  { _id: secondId, studentId: "STU002", name: "Second", email: "second@example.test", role: "student", advisor: advisorId, active: true },
  { _id: outsiderId, studentId: "STU003", name: "Other", role: "student", advisor: otherId, active: true },
];
function query(value) {
  return { select() { return this; }, sort() { return this; }, populate() { return this; }, lean: async () => value };
}
async function fixture(t) {
  const user = { _id: advisorId, role: "advisor", active: true };
  const state = { user, recordReads: [], fail: false, empty: false };
  const match = (student, filter) => Object.entries(filter).every(([key, value]) => student[key] === value);
  const User = {
    findById: () => ({ select: async () => state.user }),
    find: (filter) => query(students.filter(student => match(student, filter))),
    findOne: (filter) => query(students.find(student => match(student, filter)) || null),
  };
  const Record = { find(filter) {
    state.recordReads.push(filter);
    if (state.fail) throw new Error("Database unavailable");
    return query(state.empty ? [] : [{
      _id: filter.student, course: { code: "CSC220", title: "Course", credits: 4 },
      term: { code: "2025-3" }, grade: filter.student === firstId ? "A" : "F",
    }]);
  } };
  const app = express();
  app.use("/api/advisor", createAdvisorRoutes(User, Record, secret, {}));
  app.use((_error, _req, res, _next) => res.status(500).json({ error: { message: "Unable to load data" } }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const token = createToken(user, secret);
  const request = (path, authenticated = true) => fetch(`http://127.0.0.1:${server.address().port}/api/advisor${path}`, {
    headers: authenticated ? { Authorization: `Bearer ${token}` } : {},
  });
  return { state, request };
}

test("advisor list contains only assigned students and public fields", async t => {
  const { request } = await fixture(t);
  const response = await request("/students");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const data = await response.json();
  assert.deepEqual(data.students.map(s => s.studentId), ["STU001", "STU002"]);
  assert.deepEqual(Object.keys(data.students[0]).sort(), ["active", "email", "id", "name", "studentId"]);
});
test("selecting different students returns their own records", async t => {
  const { state, request } = await fixture(t);
  for (const [id, grade] of [[firstId, "A"], [secondId, "F"]]) {
    const response = await request(`/students/${id}/history`);
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.student.id, id);
    assert.equal(data.history[0].grade, grade);
    assert.equal(data.history[0].credits, 4);
    assert.equal(data.history[0].term, "2025-3");
  }
  assert.deepEqual(state.recordReads, [{ student: firstId }, { student: secondId }]);
});
test("unassigned, missing, malformed IDs never read records", async t => {
  const { state, request } = await fixture(t);
  for (const id of [outsiderId, "666666666666666666666666"]) {
    assert.equal((await request(`/students/${id}/history`)).status, 404);
  }
  assert.equal((await request("/students/not-an-id/history")).status, 400);
  assert.deepEqual(state.recordReads, []);
});
test("missing token, wrong roles and deactivated advisors are denied", async t => {
  const { state, request } = await fixture(t);
  for (const path of ["/students", `/students/${firstId}/history`, `/students/${firstId}/offerings`, `/students/${firstId}/registrations`]) {
    assert.equal((await request(path, false)).status, 401);
    for (const role of ["student", "admin"]) {
      state.user.role = role;
      assert.equal((await request(path)).status, 403);
    }
    state.user.role = "advisor";
    state.user.active = false;
    assert.equal((await request(path)).status, 401);
    state.user.active = true;
  }
});
test("empty history stays empty and database failure is not sample data", async t => {
  const { state, request } = await fixture(t);
  state.empty = true;
  const response = await request(`/students/${firstId}/history`);
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).history, []);
  state.fail = true;
  assert.equal((await request(`/students/${firstId}/history`)).status, 500);
});

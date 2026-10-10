import test from "node:test";
import assert from "node:assert/strict";
import { meetingsClash, offeringEligibility } from "../src/utils/registrationRules.js";
import { createRegistrationController } from "../src/controllers/registrationController.js";
const sid = "111111111111111111111111", oid = "222222222222222222222222", rid = "333333333333333333333333";
const meeting = (startTime = "09:00", endTime = "11:00", day = "Monday") => ({ startTime, endTime, day });
const base = () => ({ _id: oid, course: { _id: "course", code: "ITE220", title: "Web", credits: 4 },
  term: { _id: "term", code: "2026-1", isCurrent: true, isFinalised: false }, section: 1,
  meetings: [meeting()], capacity: 1, room: "A", instructor: "Teacher", addDropOpen: false });
test("meeting conflicts use same day and allow adjacent times", () => {
  assert.equal(meetingsClash([meeting()], [meeting("10:00", "12:00")]), true);
  assert.equal(meetingsClash([meeting()], [meeting("11:00", "13:00")]), false);
  assert.equal(meetingsClash([meeting()], [meeting("10:00", "12:00", "Tuesday")]), false);
});
test("passing grades exclude courses; W is repeatable; F flags retake until passed", () => {
  for (const grade of ["A", "B+", "B", "C+", "C", "D+", "D"]) {
    assert.equal(offeringEligibility(base(), [{ course: "course", grade }], [], 0).code, "ALREADY_PASSED");
  }
  assert.equal(offeringEligibility(base(), [{ course: "course", grade: "W" }], [], 0).eligible, true);
  assert.equal(offeringEligibility(base(), [{ course: "course", grade: "F" }], [], 0).retakeRequired, true);
  assert.equal(offeringEligibility(base(), [{ course: "course", grade: "F" }, { course: "course", grade: "D" }], [], 0).retakeRequired, false);
});
test("capacity, duplicate course across sections, timetable clash and finalisation are enforced", () => {
  assert.equal(offeringEligibility(base(), [], [], 1).code, "OFFERING_FULL");
  assert.equal(offeringEligibility(base(), [], [{ offering: { ...base(), section: 2 } }], 0).code, "ALREADY_REGISTERED");
  const other = { ...base(), course: { _id: "other", code: "CSC220" }, section: 2 };
  const clash = offeringEligibility(base(), [], [{ offering: other }], 0);
  assert.equal(clash.code, "TIMETABLE_CLASH"); assert.match(clash.reason, /CSC220 Section 2/);
  const final = base(); final.term.isFinalised = true;
  assert.equal(offeringEligibility(final, [], [], 0).code, "TERM_CLOSED");
});
function fixture() {
  const state = { rows: [], records: [], student: { active: true }, offering: base(), locks: 0, reused: false };
  const q = value => ({ session() { return this; }, populate() { return this; }, lean: async () => value, then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } });
  let pending = Promise.resolve();
  const transaction = callback => {
    const run = pending.then(async () => { const snapshot = structuredClone(state.rows);
      try { await callback({}); } catch (error) { state.rows = snapshot; throw error; }
    }); pending = run.catch(() => {}); return run;
  };
  const User = { findOne: () => q(state.student), findOneAndUpdate: () => q(state.student) };
  const Record = { find: () => q(state.records) };
  const Offering = { findOneAndUpdate: (_filter, update) => {
    Object.assign(state.offering, update.$set); return q(state.offering);
  }, findById: () => q(state.offering), updateOne: async () => ({ modifiedCount: 1 }) };
  const Term = { findOneAndUpdate: async () => { state.locks++; return state.offering.term.isCurrent && !state.offering.term.isFinalised ? {} : null; } };
  const Registration = {
    find: () => q(state.rows.filter(r => r.status === "registered").map(r => ({ ...r, offering: state.offering }))),
    countDocuments: () => q(state.rows.filter(r => r.status === "registered").length),
    findOne: filter => q(state.rows.find(r => r._id === filter._id && r.status === filter.status) ?? null),
    findOneAndUpdate: async () => { const row = state.rows.find(r => r.status === "dropped"); if (row) { row.status = "registered"; state.reused = true; } return row; },
    create: async ([data]) => { const row = { ...data, _id: rid }; state.rows.push(row); return [row]; },
    updateOne: async () => { state.rows[0].status = "dropped"; },
  };
  const controller = createRegistrationController({ User, Record, Offering, Registration, Term, transaction });
  async function call(action, overrides = {}) {
    const req = { params: { id: sid, registrationId: rid, offeringId: oid }, body: { offeringId: oid }, user: { _id: "advisor" }, ...overrides };
    const result = { status: 200 }; const res = { status(code) { result.status = code; return this; }, json(body) { result.body = body; } };
    await controller[action](req, res, error => { throw error; }); return result;
  }
  return { state, call };
}
test("registration persists, drop releases the seat, re-registration reuses dropped row", async () => {
  const { state, call } = fixture();
  assert.equal((await call("register")).status, 201);
  assert.equal(state.rows[0].status, "registered");
  assert.equal((await call("drop")).status, 200);
  assert.equal(state.rows[0].status, "dropped");
  assert.equal((await call("register")).status, 201);
  assert.equal(state.reused, true); assert.equal(state.rows.length, 1); assert.equal(state.locks, 3);
});
test("unassigned and inactive students cannot mutate registrations", async () => {
  const { state, call } = fixture();
  state.student = null; assert.equal((await call("register")).status, 404);
  state.student = { active: false }; assert.equal((await call("register")).body.error.code, "STUDENT_INACTIVE");
  assert.equal(state.rows.length, 0);
});
test("finalised terms prevent both registration and drop without changing data", async () => {
  const { state, call } = fixture(); await call("register"); state.offering.term.isFinalised = true;
  assert.equal((await call("drop")).body.error.code, "TERM_CLOSED");
  assert.equal(state.rows[0].status, "registered");
  assert.equal((await call("register")).body.error.code, "TERM_CLOSED");
});
test("malformed IDs and unexpected payload fields are rejected", async () => {
  const { call } = fixture();
  assert.equal((await call("register", { body: { offeringId: { $ne: null } } })).status, 400);
  assert.equal((await call("register", { body: { offeringId: oid, student: "someone" } })).status, 400);
});
test("concurrent controller calls serialize through the transaction boundary", async () => {
  const { state, call } = fixture();
  const results = await Promise.all([call("register"), call("register")]);
  assert.deepEqual(results.map(r => r.status).sort(), [201, 409]);
  assert.equal(state.rows.length, 1);
});

test("advisor opens with a future deadline and closes without losing the deadline", async () => {
  const { state, call } = fixture();
  const opened = await call("window", { body: { addDropOpen: true, addDropClosesAt: "2099-01-01T12:00:00+07:00" } });
  assert.equal(opened.status, 200); assert.equal(state.offering.addDropOpen, true);
  assert.equal(state.offering.addDropClosesAt.toISOString(), "2099-01-01T05:00:00.000Z");
  await call("window", { body: { addDropOpen: false } });
  assert.equal(state.offering.addDropOpen, false);
  assert.equal(state.offering.addDropClosesAt.toISOString(), "2099-01-01T05:00:00.000Z");
});
test("window rejects missing/past/ambiguous dates, unknown fields and finalised terms", async () => {
  const { state, call } = fixture();
  for (const body of [{ addDropOpen: true }, { addDropOpen: true, addDropClosesAt: "2000-01-01T00:00:00Z" },
    { addDropOpen: true, addDropClosesAt: "2099-01-01T12:00:00" }, { addDropOpen: false, capacity: 999 }]) {
    assert.equal((await call("window", { body })).status, 400);
  }
  state.offering.term.isFinalised = true;
  assert.equal((await call("window", { body: { addDropOpen: false } })).status, 409);
});

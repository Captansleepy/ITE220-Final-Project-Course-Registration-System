import test from "node:test";
import assert from "node:assert/strict";
import { buildTimetable, parseTimeRange } from "../src/utils/timetable.js";
const registration = (id, meetings) => ({ id, courseCode: id, courseName: "Example course", section: 1, meetings });

test("renders both weekly meetings of a course without counting it as two registrations", () => {
  const result = buildTimetable([registration("A", [{ day: "Monday", time: "08:30 - 10:30" }, { day: "Thursday", time: "08:30 - 10:30" }])]);
  assert.equal(result.events.length, 2); assert.notEqual(result.events[0].id, result.events[1].id);
  assert.deepEqual(result.events.map(e => e.day), ["Monday", "Thursday"]);
});
test("legacy overlapping classes get separate lanes; adjacent classes can share a lane", () => {
  const result = buildTimetable([registration("A", [{ day: "Monday", time: "09:00 - 11:00" }]), registration("B", [{ day: "Monday", time: "10:00 - 12:00" }]), registration("C", [{ day: "Monday", time: "12:00 - 14:00" }])]);
  assert.equal(result.events[0].lanes, 2); assert.notEqual(result.events[0].lane, result.events[1].lane); assert.equal(result.events[2].lanes, 1);
});
test("includes weekend and early/late classes rather than silently hiding them", () => {
  const result = buildTimetable([registration("A", [{ day: "Saturday", time: "06:30 - 08:30" }, { day: "Sunday", time: "21:30 - 23:30" }])]);
  assert(result.days.includes("Saturday")); assert(result.days.includes("Sunday")); assert.equal(result.start, 360); assert.equal(result.end, 1440);
});
test("invalid/missing meeting times are reported and never placed at a fabricated time", () => {
  for (const value of ["25:00 - 27:00", "08:99 - 10:00", "10:00 - 08:00", "", "09:00"]) assert.equal(parseTimeRange(value), null);
  const result = buildTimetable([registration("A", [{ day: "Monday", time: "invalid" }]), registration("B", [])]);
  assert.equal(result.events.length, 0); assert.deepEqual(result.unavailable, ["A", "B"]);
  assert.deepEqual(buildTimetable().days, ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]);
});

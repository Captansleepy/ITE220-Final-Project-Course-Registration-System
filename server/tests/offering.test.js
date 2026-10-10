import test from "node:test";
import assert from "node:assert/strict";
import { parseOfferingInput } from "../src/controllers/offeringController.js";

const valid = () => ({
  courseId: "111111111111111111111111",
  termId: "222222222222222222222222",
  section: 1,
  capacity: 20,
  room: "B301",
  instructor: "Test Instructor",
  meetings: [{ day: "Monday", startTime: "08:30", endTime: "12:30" }],
});

test("course offering creation validates a complete one-day meeting", () => {
  const result = parseOfferingInput(valid());
  assert.equal(result.section, 1);
  assert.equal(result.capacity, 20);
  assert.deepEqual(result.meetings, valid().meetings);
  assert.equal(result.room, "B301");
});
test("accepts correctly paired four-hour weekly schedules", () => {
  for (const [a, b] of [["Monday", "Thursday"], ["Tuesday", "Friday"]]) {
    const input = valid();
    input.meetings = [a, b].map(day => ({ day, startTime: "08:30", endTime: "10:30" }));
    assert.equal(parseOfferingInput(input).meetings.length, 2);
  }
});
test("rejects invalid schedule days, duration, mismatched slots and times", () => {
  const changes = [
    { meetings: [{ day: "Sunday", startTime: "08:30", endTime: "12:30" }] },
    { meetings: [{ day: "Monday", startTime: "08:30", endTime: "10:30" }] },
    { meetings: [{ day: "Monday", startTime: "11:00", endTime: "10:00" }] },
    { meetings: [{ day: "Monday", startTime: "08:30", endTime: "10:30" },
      { day: "Wednesday", startTime: "08:30", endTime: "10:30" }] },
    { meetings: [{ day: "Monday", startTime: "08:30", endTime: "10:30" },
      { day: "Thursday", startTime: "09:00", endTime: "11:00" }] },
  ];
  for (const change of changes) assert.throws(() => parseOfferingInput({ ...valid(), ...change }), /./);
});
test("rejects prototype injections, unexpected fields, invalid IDs and invalid capacity", () => {
  const payloads = [
    { ...valid(), unexpected: true },
    { ...valid(), courseId: { $ne: null } },
    { ...valid(), section: -1 },
    { ...valid(), capacity: 0 },
    { ...valid(), instructor: "" },
    { ...valid(), meetings: { $ne: null } },
    {},
    null,
  ];
  for (const payload of payloads) assert.throws(() => parseOfferingInput(payload), /./);
});
test("edit payload may update only room, instructor and capacity", () => {
  assert.deepEqual(parseOfferingInput({ room: "B302", capacity: 25 }, true),
    { room: "B302", capacity: 25 });
});

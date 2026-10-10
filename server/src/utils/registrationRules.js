const passing = new Set(["A", "B+", "B", "C+", "C", "D+", "D"]);
export class RegistrationError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
export function fail(status, code, message) { throw new RegistrationError(status, code, message); }
const id = value => String(value?._id ?? value);
const minutes = time => {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error("Invalid stored meeting time");
  const [h, m] = time.split(":").map(Number); return h * 60 + m;
};
export function meetingsClash(first, second) {
  return first.some(a => second.some(b => a.day === b.day &&
    minutes(a.startTime) < minutes(b.endTime) && minutes(b.startTime) < minutes(a.endTime)));
}
export function offeringEligibility(offering, records, registrations, seatsUsed) {
  if (!offering.course || !offering.term) throw new Error("Missing offering references");
  const sameCourse = records.filter(r => id(r.course) === id(offering.course));
  const passed = sameCourse.find(r => passing.has(r.grade));
  const retakeRequired = !passed && sameCourse.some(r => r.grade === "F");
  let code = null, reason = null;
  const block = (c, r) => { code = c; reason = r; };
  if (!offering.term.isCurrent || offering.term.isFinalised) block("TERM_CLOSED", "The term is not current or has been finalised.");
  else if (passed) block("ALREADY_PASSED", `Already passed — grade ${passed.grade}.`);
  else {
    for (const registration of registrations) {
      const existing = registration.offering;
      if (!existing?.course || !existing.term) throw new Error("Missing registration references");
      if (id(existing.term) !== id(offering.term)) continue;
      if (id(existing.course) === id(offering.course)) { block("ALREADY_REGISTERED", "Already registered for this course in this term."); break; }
      if (meetingsClash(offering.meetings, existing.meetings)) { block("TIMETABLE_CLASH", `Clashes with ${existing.course.code} Section ${existing.section}.`); break; }
    }
    if (!code && seatsUsed >= offering.capacity) block("OFFERING_FULL", "Full — 0 seats remaining.");
  }
  return { eligible: !code, code, reason, retakeRequired, seatsRemaining: Math.max(0, offering.capacity - seatsUsed) };
}
export function publicOffering(o) {
  if (!o.course || !o.term) throw new Error("Missing offering references");
  return { id: id(o), courseCode: o.course.code, courseTitle: o.course.title, credits: o.course.credits,
    term: o.term.code, section: o.section, meetings: o.meetings.map(m => ({ day: m.day, startTime: m.startTime, endTime: m.endTime })),
    room: o.room, instructor: o.instructor, capacity: o.capacity, addDropOpen: o.addDropOpen };
}

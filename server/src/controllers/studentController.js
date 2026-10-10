import { publicUser } from "../utils/auth.js";

const passingGrades = new Set(["A", "B+", "B", "C+", "C", "D+", "D"]);

export function buildStudentDashboard(student, records, registrations) {
  const passed = new Map();
  const failed = new Map();
  const groups = new Map();
  for (const record of records) {
    if (!record.course || !record.term) throw new Error("Academic record has a missing course or term.");
    const course = record.course;
    const courseId = String(course._id);
    const entry = {
      id: String(record._id), courseCode: course.code,
      courseName: course.title, credits: course.credits, grade: record.grade,
    };
    if (!groups.has(record.term.code)) groups.set(record.term.code, []);
    groups.get(record.term.code).push(entry);
    if (passingGrades.has(record.grade)) passed.set(courseId, course);
    if (record.grade === "F") failed.set(courseId, course);
  }
  const history = [...groups].sort(([a], [b]) => b.localeCompare(a, undefined, { numeric: true }))
    .map(([term, courses]) => ({ term, courses: courses.sort((a, b) => a.courseCode.localeCompare(b.courseCode)) }));
  const currentRegistrations = [];
  for (const registration of registrations) {
    if (registration.status !== "registered") continue;
    const offering = registration.offering;
    if (!offering?.course || !offering?.term) throw new Error("Registration has a missing offering, course or term.");
    if (!offering.term.isCurrent) continue;
    currentRegistrations.push({
      id: String(registration._id), courseCode: offering.course.code,
      courseName: offering.course.title, credits: offering.course.credits,
      section: offering.section, term: offering.term.code,
      instructor: offering.instructor,
      addDropOpen: offering.addDropOpen === true && !offering.term.isFinalised &&
        (!offering.addDropClosesAt || new Date(offering.addDropClosesAt).getTime() > Date.now()),
      addDropClosesAt: offering.addDropClosesAt ?? null,
      meetings: offering.meetings.map(meeting => ({
        day: meeting.day, time: `${meeting.startTime} - ${meeting.endTime}`, room: offering.room,
      })),
    });
  }
  return {
    student: publicUser(student),
    earnedCredits: [...passed.values()].reduce((total, course) => total + course.credits, 0),
    outstandingFailures: [...failed].filter(([id]) => !passed.has(id)).map(([, course]) => ({
      id: String(course._id), courseCode: course.code, courseName: course.title,
    })).sort((a, b) => a.courseCode.localeCompare(b.courseCode)),
    registrations: currentRegistrations.sort((a, b) => a.courseCode.localeCompare(b.courseCode) || a.section - b.section),
    history,
  };
}

export function createStudentController(Record, Registration, User) {
  return {
    async dashboard(req, res) {
      // Identity comes only from the authenticated user, never from request parameters.
      const [records, registrations] = await Promise.all([
        Record.find({ student: req.user._id })
          .populate("course", "code title credits")
          .populate("term", "code").lean(),
        Registration.find({ student: req.user._id, status: "registered" })
          .populate({ path: "offering", populate: [
            { path: "course", select: "code title credits" },
            { path: "term", select: "code isCurrent isFinalised" },
          ] }).lean(),
      ]);
      const advisor = req.user.advisor ? await User.findOne({
        _id: req.user.advisor, role: "advisor", active: true,
      }).select("name email").lean() : null;
      return res.json({ ...buildStudentDashboard(req.user, records, registrations),
        advisor: advisor ? { name: advisor.name, email: advisor.email } : null });
    },
  };
}

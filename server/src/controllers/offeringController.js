import mongoose from "mongoose";
import { RegistrationError, fail } from "../utils/registrationRules.js";

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const allowed = new Set(["courseId", "termId", "section", "meetings", "room", "instructor", "capacity"]);
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const timeMinutes = text => Number(text.slice(0, 2)) * 60 + Number(text.slice(3));

/** Validate the complete timetable and refuse unknown or unsafe input fields. */
export function parseOfferingInput(body, partial = false) {
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      Object.keys(body).some(key => !allowed.has(key)) ||
      Object.keys(body).length === 0) {
    fail(400, "INVALID_INPUT", "Provide only supported offering fields.");
  }
  if (!partial && [...allowed].some(key => body[key] === undefined)) {
    fail(400, "INVALID_INPUT", "Course, term, section, meetings, room, instructor and capacity are required.");
  }
  const out = {};
  for (const [input, field] of [["courseId", "course"], ["termId", "term"]]) {
    if (body[input] !== undefined) {
      if (typeof body[input] !== "string" || !mongoose.isObjectIdOrHexString(body[input])) {
        fail(400, "INVALID_ID", "Course and term IDs must be valid MongoDB IDs.");
      }
      out[field] = body[input];
    }
  }
  if (body.section !== undefined) {
    if (!Number.isInteger(body.section) || body.section < 1) fail(400, "INVALID_INPUT", "Section must be a positive integer.");
    out.section = body.section;
  }
  if (body.capacity !== undefined) {
    if (!Number.isInteger(body.capacity) || body.capacity < 1) fail(400, "INVALID_INPUT", "Capacity must be a positive integer.");
    out.capacity = body.capacity;
  }
  for (const field of ["room", "instructor"]) {
    if (body[field] !== undefined) {
      if (typeof body[field] !== "string" || !body[field].trim() || body[field].trim().length > 120) {
        fail(400, "INVALID_INPUT", "Room and instructor must contain 1–120 characters.");
      }
      out[field] = body[field].trim();
    }
  }
  if (body.meetings !== undefined) {
    const items = body.meetings;
    if (!Array.isArray(items) || ![1, 2].includes(items.length)) {
      fail(400, "INVALID_SCHEDULE", "Use one four-hour weekday meeting or two two-hour weekday meetings.");
    }
    const meetings = items.map(item => {
      if (!item || typeof item !== "object" || Array.isArray(item) ||
          Object.keys(item).some(key => !["day", "startTime", "endTime"].includes(key)) ||
          !days.includes(item.day) || typeof item.startTime !== "string" ||
          typeof item.endTime !== "string" ||
          !timePattern.test(item.startTime) || !timePattern.test(item.endTime)) {
        fail(400, "INVALID_SCHEDULE", "Invalid meeting day or HH:mm time.");
      }
      const duration = timeMinutes(item.endTime) - timeMinutes(item.startTime);
      if (duration !== (items.length === 1 ? 240 : 120)) {
        fail(400, "INVALID_SCHEDULE", "Meetings must total exactly four hours with valid start/end times.");
      }
      return { day: item.day, startTime: item.startTime, endTime: item.endTime };
    });
    if (meetings.length === 2) {
      const both = meetings.map(m => m.day).sort().join("/");
      if (!["Monday/Thursday", "Friday/Tuesday"].includes(both) ||
          meetings[0].startTime !== meetings[1].startTime ||
          meetings[0].endTime !== meetings[1].endTime) {
        fail(400, "INVALID_SCHEDULE", "Paired meetings must be Mon/Thu or Tue/Fri with matching times.");
      }
    }
    out.meetings = meetings;
  }
  return out;
}

function errorResponse(res, error, next) {
  if (error instanceof RegistrationError) {
    return res.status(error.status).json({ error: { code: error.code, message: error.message } });
  }
  if (error?.code === 11000) {
    return res.status(409).json({ error: { code: "DUPLICATE_SECTION", message: "This course, term and section already exists." } });
  }
  if (error instanceof mongoose.Error.ValidationError || error instanceof mongoose.Error.CastError) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Please check the offering fields and schedule." } });
  }
  return next(error);
}

export function createOfferingController({ Course, Term, Offering, Registration,
  transaction = callback => mongoose.connection.transaction(callback) }) {
  const wrap = handler => async (req, res, next) => {
    try { await handler(req, res); }
    catch (error) { return errorResponse(res, error, next); }
  };
  const validId = value => {
    if (!mongoose.isObjectIdOrHexString(value)) fail(400, "INVALID_ID", "Invalid offering ID.");
  };
  const termLock = async (id, session) => {
    const term = await Term.findOneAndUpdate(
      { _id: id, isCurrent: true, isFinalised: false },
      { $inc: { registrationRevision: 1 } },
      { new: true, session }
    );
    if (!term) fail(409, "TERM_CLOSED", "Only current, non-finalised term offerings can be changed.");
  };
  const publicRow = (doc, seatsTaken) => ({
    id: String(doc._id),
    courseId: String(doc.course?._id ?? doc.course),
    courseCode: doc.course?.code,
    courseTitle: doc.course?.title,
    termId: String(doc.term?._id ?? doc.term),
    term: doc.term?.code,
    section: doc.section,
    meetings: doc.meetings,
    room: doc.room,
    instructor: doc.instructor,
    capacity: doc.capacity,
    seatsTaken,
    seatsRemaining: Math.max(0, doc.capacity - seatsTaken),
    addDropOpen: Boolean(doc.addDropOpen) && !doc.term?.isFinalised &&
      (!doc.addDropClosesAt || new Date(doc.addDropClosesAt) > new Date()),
    addDropClosesAt: doc.addDropClosesAt ?? null,
  });
  const hasRegistrations = async (id, session) => Boolean(
    await Registration.exists({ offering: id }).session(session)
  );
  return {
    catalog: wrap(async (_req, res) => {
      const [courses, terms] = await Promise.all([
        Course.find({}).select("code title credits").sort({ code: 1 }).lean(),
        Term.find({ isCurrent: true, isFinalised: false }).select("code").lean(),
      ]);
      res.json({
        courses: courses.map(c => ({ id: String(c._id), code: c.code, title: c.title, credits: c.credits })),
        terms: terms.map(t => ({ id: String(t._id), code: t.code })),
      });
    }),
    list: wrap(async (_req, res) => {
      const terms = await Term.find({ isCurrent: true }).select("_id").lean();
      const rows = await Offering.find({ term: { $in: terms.map(t => t._id) } })
        .populate("course", "code title credits").populate("term", "code isFinalised").lean();
      const offerings = await Promise.all(rows.map(async row =>
        publicRow(row, await Registration.countDocuments({ offering: row._id, status: "registered" }))
      ));
      offerings.sort((a, b) => (a.courseCode ?? "").localeCompare(b.courseCode ?? "") || a.section - b.section);
      res.json({ offerings });
    }),
    create: wrap(async (req, res) => {
      const input = parseOfferingInput(req.body);
      let created;
      await transaction(async session => {
        await termLock(input.term, session);
        if (!await Course.exists({ _id: input.course }).session(session)) {
          fail(404, "COURSE_NOT_FOUND", "The selected course does not exist.");
        }
        [created] = await Offering.create([{ ...input, addDropOpen: false, addDropClosesAt: null }], { session });
      });
      const row = await Offering.findById(created._id).populate("course").populate("term").lean();
      res.status(201).json({ offering: publicRow(row, 0) });
    }),
    update: wrap(async (req, res) => {
      validId(req.params.offeringId);
      const patch = parseOfferingInput(req.body, true);
      let updated;
      await transaction(async session => {
        const offering = await Offering.findById(req.params.offeringId).session(session);
        if (!offering) fail(404, "OFFERING_NOT_FOUND", "Offering not found.");
        await termLock(offering.term, session);
        const enrolled = await Registration.countDocuments({ offering: offering._id, status: "registered" }).session(session);
        const anyHistory = await hasRegistrations(offering._id, session);
        if (patch.capacity !== undefined && patch.capacity < enrolled) {
          fail(409, "CAPACITY_TOO_SMALL", "Capacity cannot be smaller than the number of registered students.");
        }
        if (anyHistory && ["course", "term", "section", "meetings"].some(key => patch[key] !== undefined)) {
          fail(409, "HAS_REGISTRATIONS", "Course, term, section and schedule cannot be changed while registration history exists.");
        }
        if (patch.term && String(patch.term) !== String(offering.term)) {
          fail(400, "TERM_IMMUTABLE", "Move an offering by creating a new section in the target current term.");
        }
        if (patch.course && !await Course.exists({ _id: patch.course }).session(session)) {
          fail(404, "COURSE_NOT_FOUND", "Course not found.");
        }
        offering.set(patch);
        await offering.save({ session });
        updated = offering._id;
      });
      const row = await Offering.findById(updated).populate("course").populate("term").lean();
      const taken = await Registration.countDocuments({ offering: updated, status: "registered" });
      res.json({ offering: publicRow(row, taken) });
    }),
    remove: wrap(async (req, res) => {
      validId(req.params.offeringId);
      await transaction(async session => {
        const offering = await Offering.findById(req.params.offeringId).session(session);
        if (!offering) fail(404, "OFFERING_NOT_FOUND", "Offering not found.");
        await termLock(offering.term, session);
        if (await hasRegistrations(offering._id, session)) {
          fail(409, "HAS_REGISTRATIONS", "This section has registration history. Preserve it instead of deleting the section.");
        }
        await Offering.deleteOne({ _id: offering._id }, { session });
      });
      res.json({ deleted: true, id: req.params.offeringId });
    }),
  };
}

import mongoose from "mongoose";
import { fail, RegistrationError, offeringEligibility, publicOffering } from "../utils/registrationRules.js";

export function createRegistrationController({ User, Record, Offering, Registration, Term,
  transaction = callback => mongoose.connection.transaction(callback) }) {
  const valid = value => { if (!mongoose.isObjectIdOrHexString(value)) fail(400, "INVALID_ID", "Invalid resource ID."); };
  const scopedStudent = async (req, session, mutate = false) => {
    valid(req.params.id);
    const filter = { _id: req.params.id, role: "student", advisor: req.user._id };
    // Touch the student inside the transaction to conflict with concurrent reassignment/deactivation.
    const student = mutate
      ? await User.findOneAndUpdate(filter, { $set: { updatedAt: new Date() } }, { new: true, session }).lean()
      : await User.findOne(filter).session(session ?? null).lean();
    if (!student) fail(404, "STUDENT_NOT_FOUND", "Student not found in your assigned students.");
    if (mutate && !student.active) fail(409, "STUDENT_INACTIVE", "Inactive students cannot be registered or dropped.");
    return student;
  };
  const populated = query => query.populate({ path: "offering", populate: [{ path: "course" }, { path: "term" }] });
  const active = (student, session) => populated(Registration.find({ student, status: "registered" }).session(session ?? null)).lean();
  const offering = (value, session) => Offering.findById(value).session(session ?? null).populate("course").populate("term").lean();
  const lockTerm = async (term, session) => {
    if (!term) throw new Error("Missing offering term");
    // All registration writes contend on this document. Transaction retries prevent capacity
    // and timetable write skew, including concurrent requests for different offerings.
    const locked = await Term.findOneAndUpdate({ _id: term._id, isCurrent: true, isFinalised: false },
      { $inc: { registrationRevision: 1 } }, { new: true, session });
    if (!locked) fail(409, "TERM_CLOSED", "The term is not current or has been finalised.");
  };
  const wrap = handler => async (req, res, next) => {
    try { await handler(req, res); } catch (error) {
      if (error instanceof RegistrationError) return res.status(error.status).json({ error: { code: error.code, message: error.message } });
      if (error.code === 11000) return res.status(409).json({ error: { code: "ALREADY_REGISTERED", message: "This registration already exists." } });
      next(error);
    }
  };
  return {
    window: wrap(async (req, res) => {
      valid(req.params.offeringId);
      if (!req.body || typeof req.body.addDropOpen !== "boolean" ||
          Object.keys(req.body).some(key => !["addDropOpen", "addDropClosesAt"].includes(key))) {
        fail(400, "INVALID_INPUT", "Provide addDropOpen and, when opening, a closing date.");
      }
      const deadline = req.body.addDropOpen ? new Date(req.body.addDropClosesAt) : null;
      if (req.body.addDropOpen && (typeof req.body.addDropClosesAt !== "string" ||
          !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(req.body.addDropClosesAt) ||
          !Number.isFinite(deadline.getTime()) || deadline.getTime() <= Date.now())) {
        fail(400, "INVALID_INPUT", "The closing date must be a future timestamp with a timezone.");
      }
      let updated;
      await transaction(async session => {
        const o = await offering(req.params.offeringId, session);
        if (!o) fail(404, "OFFERING_NOT_FOUND", "Offering not found.");
        await lockTerm(o.term, session);
        const row = await Offering.findOneAndUpdate({ _id: o._id }, { $set: {
          addDropOpen: req.body.addDropOpen,
          ...(deadline ? { addDropClosesAt: deadline } : {}),
        } }, { new: true, session, runValidators: true }).populate("course").populate("term").lean();
        updated = publicOffering(row);
      });
      res.json({ offering: updated });
    }),
    list: wrap(async (req, res) => {
      await scopedStudent(req);
      const registrations = await active(req.params.id);
      if (registrations.some(r => !r.offering?.term)) throw new Error("Missing registration references");
      res.json({ registrations: registrations.filter(r => r.offering.term.isCurrent).map(r => ({ id: String(r._id), status: r.status, offering: publicOffering(r.offering) })) });
    }),
    offerings: wrap(async (req, res) => {
      await scopedStudent(req);
      const terms = await Term.find({ isCurrent: true }).lean();
      const offerings = await Offering.find({ term: { $in: terms.map(t => t._id) } }).populate("course").populate("term").lean();
      const records = await Record.find({ student: req.params.id }).lean();
      const registrations = await active(req.params.id);
      const result = [];
      for (const o of offerings) {
        const used = await Registration.countDocuments({ offering: o._id, status: "registered" });
        result.push({ ...publicOffering(o), ...offeringEligibility(o, records, registrations, used) });
      }
      result.sort((a, b) => Number(b.retakeRequired) - Number(a.retakeRequired) || a.courseCode.localeCompare(b.courseCode) || a.section - b.section);
      res.json({ offerings: result });
    }),
    register: wrap(async (req, res) => {
      valid(req.params.id); valid(req.body?.offeringId);
      if (Object.keys(req.body).some(key => key !== "offeringId")) fail(400, "INVALID_INPUT", "Only offeringId is accepted.");
      await scopedStudent(req);
      let result;
      await transaction(async session => {
        const o = await offering(req.body.offeringId, session);
        if (!o) fail(404, "OFFERING_NOT_FOUND", "Offering not found.");
        await lockTerm(o.term, session);
        await scopedStudent(req, session, true);
        // Touch the offering to conflict with concurrent edits of its capacity or timetable.
        await Offering.updateOne({ _id: o._id }, { $set: { updatedAt: new Date() } }, { session });
        const records = await Record.find({ student: req.params.id }).session(session).lean();
        const registrations = await active(req.params.id, session);
        const used = await Registration.countDocuments({ offering: o._id, status: "registered" }).session(session);
        const rule = offeringEligibility(o, records, registrations, used);
        if (!rule.eligible) fail(409, rule.code, rule.reason);
        // Reuse a dropped row, compatible with both unique and partial unique seed indexes.
        let row = await Registration.findOneAndUpdate({ student: req.params.id, offering: o._id, status: "dropped" },
          { $set: { status: "registered" } }, { new: true, session });
        if (!row) [row] = await Registration.create([{ student: req.params.id, offering: o._id, status: "registered" }], { session });
        result = { id: String(row._id), status: row.status, offering: publicOffering(o) };
      });
      res.status(201).json({ registration: result });
    }),
    drop: wrap(async (req, res) => {
      valid(req.params.id); valid(req.params.registrationId);
      await scopedStudent(req);
      await transaction(async session => {
        const row = await Registration.findOne({ _id: req.params.registrationId, student: req.params.id, status: "registered" }).session(session).lean();
        if (!row) fail(404, "REGISTRATION_NOT_FOUND", "Active registration not found.");
        const o = await offering(row.offering, session);
        if (!o) throw new Error("Missing registration offering");
        await lockTerm(o.term, session);
        await scopedStudent(req, session, true);
        await Registration.updateOne({ _id: row._id, status: "registered" }, { $set: { status: "dropped" } }, { session });
      });
      res.json({ registration: { id: req.params.registrationId, status: "dropped" } });
    }),
  };
}

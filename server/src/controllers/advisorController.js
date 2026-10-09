import mongoose from "mongoose";
import { authError } from "../utils/auth.js";

const studentFields = "name email studentId active";
const publicStudent = (student) => ({
  id: String(student._id),
  name: student.name,
  email: student.email,
  studentId: student.studentId,
  active: student.active,
});

export function createAdvisorController(User, Record) {
  return {
    async listStudents(req, res) {
      const students = await User.find({ role: "student", advisor: req.user._id })
        .select(studentFields).sort({ studentId: 1 }).lean();
      return res.json({ students: students.map(publicStudent) });
    },
    async history(req, res) {
      if (!mongoose.isObjectIdOrHexString(req.params.id)) {
        return authError(res, 400, "INVALID_ID", "Invalid student ID.");
      }
      // Scope the lookup to the authenticated advisor before reading any records.
      const student = await User.findOne({
        _id: req.params.id, role: "student", advisor: req.user._id,
      }).select(studentFields).lean();
      if (!student) {
        return authError(res, 404, "STUDENT_NOT_FOUND", "Student not found in your assigned students.");
      }
      const records = await Record.find({ student: student._id })
        .populate("course", "code title credits")
        .populate("term", "code")
        .lean();
      const history = records.map((record) => ({
        id: String(record._id),
        courseCode: record.course?.code ?? "Unavailable",
        courseTitle: record.course?.title ?? "Unavailable",
        credits: record.course?.credits ?? null,
        term: record.term?.code ?? "Unavailable",
        grade: record.grade,
      })).sort((a, b) => b.term.localeCompare(a.term, undefined, { numeric: true }) || a.courseCode.localeCompare(b.courseCode));
      return res.json({ student: publicStudent(student), history });
    },
  };
}

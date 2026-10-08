import assert from "node:assert/strict";
import mongoose from "mongoose";
import connectDB from "../src/config/db.js";
import User from "../src/models/User.js";

try {
  await connectDB();

  const total = await User.countDocuments();
  const students = await User.countDocuments({ role: "student" });
  const advisors = await User.countDocuments({ role: "advisor" });
  const admins = await User.countDocuments({ role: "admin" });

  console.log({ total, students, advisors, admins });

  assert.equal(total, 28, "Expected 28 users.");
  assert.equal(students, 25, "Expected 25 students.");
  assert.equal(advisors, 2, "Expected 2 advisors.");
  assert.equal(admins, 1, "Expected 1 admin.");

  const ordinaryUser = await User.findOne({
    role: "student",
  }).lean();

  assert.ok(ordinaryUser, "Student not found.");
  assert.equal(
    Object.hasOwn(ordinaryUser, "passwordHash"),
    false,
    "Normal queries must hide passwordHash."
  );

  const loginUser = await User.findById(ordinaryUser._id)
    .select("+passwordHash");

  assert.ok(
    typeof loginUser.passwordHash === "string" &&
      loginUser.passwordHash.startsWith("$2"),
    "Expected an existing bcrypt hash."
  );

  const studentDocs = await User.find({
    role: "student",
  }).lean();

  for (const student of studentDocs) {
    assert.ok(student.studentId, "Student ID missing.");

    const advisor = await User.findOne({
      _id: student.advisor,
      role: "advisor",
      active: true,
    }).lean();

    assert.ok(advisor, "Student has no valid active advisor.");
  }

  console.log(
    "PASS: user counts, password selection, and advisor references."
  );
  console.log("Read-only check: no data changed.");
} catch (error) {
  console.error("User check failed:", error.name);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
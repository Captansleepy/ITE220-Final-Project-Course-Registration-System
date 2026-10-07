const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');
const xlsx = require('xlsx');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// 1. Schemas
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  passwordHash: String,
  role: { type: String, enum: ['admin', 'advisor', 'student'] },
  studentId: String,
  advisor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  active: { type: Boolean, default: true }
});

const courseSchema = new mongoose.Schema({
  code: { type: String, unique: true },
  title: String,
  credits: { type: Number, default: 4 },
  description: String
});

const termSchema = new mongoose.Schema({
  code: { type: String, unique: true },
  isCurrent: { type: Boolean, default: false },
  isFinalised: { type: Boolean, default: false }
});

const offeringSchema = new mongoose.Schema({
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
  term: { type: mongoose.Schema.Types.ObjectId, ref: 'Term' },
  section: Number,
  day: String,
  startTime: String,
  endTime: String,
  room: String,
  instructor: String,
  capacity: Number
});

const recordSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
  term: { type: mongoose.Schema.Types.ObjectId, ref: 'Term' },
  grade: String
});

const registrationSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  offering: { type: mongoose.Schema.Types.ObjectId, ref: 'Offering' },
  status: { type: String, default: 'registered' },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Course = mongoose.model('Course', courseSchema);
const Term = mongoose.model('Term', termSchema);
const Offering = mongoose.model('Offering', offeringSchema);
const Record = mongoose.model('Record', recordSchema);
const Registration = mongoose.model('Registration', registrationSchema);

// ตารางแก้ไขชื่อวิชาให้ถูกต้องตามหลักสูตร
const courseCodeFixes = {
  'ITE476': 'Network II',
  'ITE477': 'Windows Server',
  'MAT101': 'College Algebra'
};

async function seedDatabase() {
  try {
    const mongoURI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/course_registration';
    await mongoose.connect(mongoURI, {
  family: 4
});

    // เคลียร์ข้อมูลเก่า
    await Promise.all([
      User.deleteMany({}),
      Course.deleteMany({}),
      Term.deleteMany({}),
      Offering.deleteMany({}),
      Record.deleteMany({}),
      Registration.deleteMany({})
    ]);

    const defaultPasswordHash = await bcrypt.hash('Password123!', 10);

    // สร้าง Admin และ Advisors
    const admin = await User.create({
      name: 'System Admin',
      email: 'admin@system.com',
      passwordHash: defaultPasswordHash,
      role: 'admin'
    });

    const advisorWendy = await User.create({
      name: 'Wendy Luu',
      email: 'wendylu@gmail.com',
      passwordHash: defaultPasswordHash,
      role: 'advisor'
    });

    const advisorZak = await User.create({
      name: 'Zak',
      email: 'zak@gmail.com',
      passwordHash: defaultPasswordHash,
      role: 'advisor'
    });

    // อ่าน Excel
    const workbook = xlsx.readFile('CSC220-Project-Info_final_1.xlsx');
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet);

    const studentRows = rows.filter(r => !String(r['Name (Fake)']).includes('advisor'));

    const studentMap = {};
    let stuCounter = 1;

    for (const row of studentRows) {
      const studentId = `STU${String(stuCounter).padStart(3, '0')}`;
      const advisor = (stuCounter % 2 === 1) ? advisorWendy._id : advisorZak._id;

      const student = await User.create({
        name: row['Name (Fake)'].trim(),
        email: row['Email (Fake)'].trim().toLowerCase(),
        passwordHash: defaultPasswordHash,
        role: 'student',
        studentId: studentId,
        advisor: advisor
      });

      studentMap[student.name] = student._id;
      stuCounter++;
    }

    const courseMap = {};
    const termMap = {};
    const ipRegistrationsToCreate = [];

    const currentTermDoc = await Term.create({ code: '2026-1', isCurrent: true, isFinalised: false });
    termMap['2026-1'] = currentTermDoc._id;

    for (const row of studentRows) {
      const studentName = row['Name (Fake)'].trim();
      const studentObjId = studentMap[studentName];

      for (let i = 1; i <= 10; i++) {
        const codeKey = i === 1 ? 'Course Code' : `Course Code.${i - 1}`;
        const nameKey = i === 1 ? 'Course Name(1)' : `Course Name(${i})`;
        const gradeKey = i === 1 ? 'Grade' : `Grade.${i - 1}`;
        const termKey = i === 1 ? 'Term' : `Term.${i - 1}`;

        let code = row[codeKey];
        let name = row[nameKey];
        const grade = row[gradeKey];
        const rawTerm = row[termKey];

        if (!code || !name) continue;
        code = code.trim();
        name = name.trim();

        if (courseCodeFixes[code]) {
          name = courseCodeFixes[code];
        }

        if (!courseMap[code]) {
          const cDoc = await Course.findOneAndUpdate(
            { code: code },
            { code: code, title: name, credits: 4 },
            { upsert: true, new: true }
          );
          courseMap[code] = cDoc._id;
        }

        let termCode = '2026-1';
        if (rawTerm) {
          const date = new Date(rawTerm);
          if (!isNaN(date.valueOf())) {
            const year = date.getFullYear();
            const month = date.getMonth() + 1;
            termCode = `${year}-${month}`;
          }
        }

        if (!termMap[termCode] && termCode !== '2026-1') {
          const tDoc = await Term.findOneAndUpdate(
            { code: termCode },
            { code: termCode, isCurrent: false, isFinalised: true },
            { upsert: true, new: true }
          );
          termMap[termCode] = tDoc._id;
        }

        if (grade === 'IP (In Progress)') {
          ipRegistrationsToCreate.push({
            studentId: studentObjId,
            courseId: courseMap[code]
          });
        } else if (grade) {
          await Record.create({
            student: studentObjId,
            course: courseMap[code],
            term: termMap[termCode],
            grade: grade
          });
        }
      }
    }

    // สร้าง Offerings และ Registrations
    for (const ipItem of ipRegistrationsToCreate) {
      let offering = await Offering.findOne({
        course: ipItem.courseId,
        term: currentTermDoc._id
      });

      if (!offering) {
        offering = await Offering.create({
          course: ipItem.courseId,
          term: currentTermDoc._id,
          section: 1,
          day: 'Monday',
          startTime: '09:00',
          endTime: '12:00',
          room: 'Room 301',
          instructor: 'Dr. Smith',
          capacity: 40
        });
      }

      await Registration.create({
        student: ipItem.studentId,
        offering: offering._id,
        status: 'registered'
      });
    }

    console.log(' Database Seeded Successfully!');
    process.exit(0);
  } catch (err) {
    console.error(' Error seeding database:', err);
    process.exit(1);
  }
}

seedDatabase();
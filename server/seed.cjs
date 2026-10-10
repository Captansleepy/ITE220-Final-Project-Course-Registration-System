/* Run from server: node --env-file=.env seed.cjs --preview
 * Schedule version 2: every offering has meetings[], totalling four hours.
 * Import: node --env-file=.env seed.cjs --apply
 * Import only accepts a NEW EMPTY course_registration_seed_<name> database.
 */
'use strict';
const dns = require('node:dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const fs = require('node:fs');
const path = require('node:path');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const clean = value => String(value ?? '').trim();
const currentTerm = '2026-1';
const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
function minutes(time) {
  assert(typeof time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(time), `Invalid HH:mm time: ${time}`);
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}
function validateMeetings(offering) {
  const meetings = offering.meetings;
  assert(!['day', 'startTime', 'endTime'].some(key => key in offering), `${offering.code}: replace old single-time fields with meetings[].`);
  assert(Array.isArray(meetings) && [1, 2].includes(meetings.length), `${offering.code}: use one four-hour meeting or two two-hour meetings.`);
  for (const meeting of meetings) {
    assert(weekdays.includes(meeting.day), `${offering.code}: use a weekday.`);
    const duration = minutes(meeting.endTime) - minutes(meeting.startTime);
    assert(duration === (meetings.length === 1 ? 240 : 120), `${offering.code}: each meeting must be ${meetings.length === 1 ? 4 : 2} hours.`);
  }
  if (meetings.length === 2) {
    const [a, b] = [...meetings].sort((a, b) => weekdays.indexOf(a.day) - weekdays.indexOf(b.day));
    assert((a.day === 'Monday' && b.day === 'Thursday') || (a.day === 'Tuesday' && b.day === 'Friday'), `${offering.code}: split meetings must be Monday/Thursday or Tuesday/Friday.`);
    assert(a.startTime === b.startTime && a.endTime === b.endTime, `${offering.code}: split meetings must have matching times.`);
  }
  return meetings.length === 1 ? 'single-4h' : 'split-2h';
}
function clashes(a, b) {
  return a.meetings.some(x => b.meetings.some(y => x.day === y.day && minutes(x.startTime) < minutes(y.endTime) && minutes(y.startTime) < minutes(x.endTime)));
}
function validatePatterns(offerings) {
  const patterns = new Map();
  for (const offering of offerings) {
    const pattern = validateMeetings(offering);
    assert(!patterns.has(offering.code) || patterns.get(offering.code) === pattern, `${offering.code}: every section must use the same course pattern.`);
    patterns.set(offering.code, pattern);
  }
}
function readData() {
  const XLSX = require('xlsx');
  const file = path.resolve(__dirname, process.env.SEED_FILE || 'CSC220-Project-Info_final_1.xlsx');
  assert(fs.existsSync(file), `Workbook not found: ${file}`);
  const book = XLSX.readFile(file, { cellDates: false });
  const rows = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { header: 1, raw: true, defval: '', blankrows: true });
  const header = rows[0] || [];
  assert(clean(header[1]) === 'Name (Fake)' && clean(header[2]) === 'Email (Fake)', 'Expected names in B and emails in C.');
  for (let i = 0; i < 10; i++) {
    const base = 3 + 4 * i;
    assert(clean(header[base + 1]) === 'Course Code' && clean(header[base + 2]) === 'Grade' && clean(header[base + 3]) === 'Term', `Unexpected headers in block ${i + 1}.`);
  }
  const termOf = (value, location) => {
    let year, semester;
    if (typeof value === 'number') {
      const d = XLSX.SSF.parse_date_code(value, { date1904: !!book.Workbook?.WBProps?.date1904 });
      assert(d, `${location}: invalid Excel date.`);
      year = d.y; semester = d.m;
    } else {
      const s = clean(value);
      const first = s.match(/^([1-3])\s*\/\s*(\d{4})$/);
      const second = s.match(/^(\d{4})-([1-3])$/);
      assert(first || second, `${location}: expected Excel date, m/yyyy, or yyyy-semester.`);
      year = Number(first ? first[2] : second[1]); semester = Number(first ? first[1] : second[2]);
    }
    assert(year >= 2000 && year <= 2100 && [1, 2, 3].includes(semester), `${location}: invalid term.`);
    return `${year}-${semester}`;
  };
  const students = [], advisors = [], attempts = [], courses = new Map(), terms = new Set([currentTerm]);
  const emails = new Set(), keys = new Set();
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row.slice(1, 43).some(v => clean(v))) continue;
    const name = clean(row[1]), email = clean(row[2]).toLowerCase();
    assert(name && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), `Row ${r + 1}: name/email missing or invalid.`);
    assert(!emails.has(email), `Duplicate email on row ${r + 1}.`); emails.add(email);
    if (/\(\s*advisor\s*\)/i.test(name)) { advisors.push({ name: name.replace(/\(\s*advisor\s*\)/i, '').trim(), email }); continue; }
    const studentId = `STU${String(students.length + 1).padStart(3, '0')}`;
    students.push({ name, email, studentId });
    for (let i = 0; i < 10; i++) {
      const base = 3 + i * 4, location = `Row ${r + 1}, course ${i + 1}`;
      const title = clean(row[base]), code = clean(row[base + 1]).toUpperCase().replace(/\s+/g, '');
      let grade = clean(row[base + 2]).toUpperCase().replace(/\s+/g, '');
      if (/^IP(?:\(INPROGRESS\))?$/.test(grade)) grade = 'IP';
      assert(title && code && grade && clean(row[base + 3]), `${location}: incomplete entry.`);
      assert(['A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'F', 'W', 'IP'].includes(grade), `${location}: unsupported grade.`);
      const term = termOf(row[base + 3], location);
      assert(grade !== 'IP' || term === currentTerm, `${location}: IP outside current term.`);
      const old = courses.get(code);
      assert(!old || old.toLowerCase() === title.toLowerCase(), `${location}: inconsistent title for ${code}.`);
      courses.set(code, old || title); terms.add(term);
      const key = `${studentId}|${code}|${term}`;
      assert(!keys.has(key), `${location}: duplicate student/course/term.`); keys.add(key);
      attempts.push({ studentId, code, term, grade });
    }
  }
  assert(students.length === 25 && advisors.length === 2, 'Expected 25 students and 2 advisors.');
  assert(!emails.has('admin@example.test'), 'Admin email conflicts with source.');
  return { students, advisors, attempts, courses, terms };
}
function validateConfig(data, config) {
  for (const code of data.courses.keys()) assert(config.credits?.[code] === 4, `${code}: credits must be 4 as agreed.`);
  for (const s of data.students) assert(data.advisors.some(a => a.email === config.advisorAssignments?.[s.studentId]), `${s.studentId}: advisor email must match the workbook.`);
  assert(Array.isArray(config.offerings), 'Config requires offerings[].');
  validatePatterns(config.offerings);
  const needed = new Set(data.attempts.filter(a => a.grade === 'IP').map(a => a.code)), byCode = new Map();
  for (const o of config.offerings) {
    assert(needed.has(o.code) && !byCode.has(o.code), `${o.code}: this seed uses exactly one offering per IP course; all its students share that schedule.`);
    assert(Number.isInteger(o.section) && o.section > 0, `${o.code}: invalid section.`);
    assert(clean(o.room) && clean(o.instructor), `${o.code}: room/instructor required.`);
    const count = data.attempts.filter(a => a.grade === 'IP' && a.code === o.code).length;
    assert(Number.isInteger(o.capacity) && o.capacity >= count, `${o.code}: insufficient capacity for ${count} students.`);
    assert(o.addDropOpen === false, `${o.code}: seed with add/drop closed.`);
    byCode.set(o.code, o);
  }
  assert(byCode.size === needed.size, 'Missing IP offerings.');
  for (let i = 0; i < config.offerings.length; i++) for (let j = i + 1; j < config.offerings.length; j++) {
    const a = config.offerings[i], b = config.offerings[j];
    assert(!clashes(a, b) || (clean(a.room).toLowerCase() !== clean(b.room).toLowerCase() && clean(a.instructor).toLowerCase() !== clean(b.instructor).toLowerCase()), `Room/instructor clash: ${a.code}, ${b.code}.`);
  }
  for (const s of data.students) {
    const schedule = data.attempts.filter(a => a.studentId === s.studentId && a.grade === 'IP').map(a => byCode.get(a.code));
    for (let i = 0; i < schedule.length; i++) for (let j = i + 1; j < schedule.length; j++) assert(!clashes(schedule[i], schedule[j]), `${s.studentId}: clash between ${schedule[i].code} and ${schedule[j].code}.`);
  }
}
async function importData(data, config) {
  const mongoose = require('mongoose'), bcrypt = require('bcryptjs');
  const uri = process.env.MONGODB_URI, dbName = process.env.MONGODB_DB_NAME;
  assert(uri && /^course_registration_seed_[a-z0-9_]+$/.test(dbName || ''), 'Set MONGODB_URI and a NEW MONGODB_DB_NAME=course_registration_seed_<name> in .env.');
  assert(process.env.SEED_PASSWORD?.length >= 12, 'Set a demo SEED_PASSWORD of at least 12 characters in .env.');
  try {
    await mongoose.connect(uri, { dbName, serverSelectionTimeoutMS: 10000 });
    const db = mongoose.connection.db;
    assert((await db.listCollections({}, { nameOnly: true }).toArray()).length === 0, 'Target contains collections. No changes made. Use a new empty development database.');
    const id = () => new mongoose.Types.ObjectId(), passwordHash = await bcrypt.hash(process.env.SEED_PASSWORD, 12);
    const users = [{ _id: id(), name: 'System Admin', email: 'admin@example.test', role: 'admin', active: true, passwordHash }];
    const advisorIds = new Map(), studentIds = new Map();
    for (const [index, a] of data.advisors.entries()) {
      const _id = id(), number = String(index + 1).padStart(3, '0');
      advisorIds.set(a.email, _id);
      users.push({ _id, name: `Demo Advisor ${number}`, email: `advisor${number}@example.test`, role: 'advisor', active: true, passwordHash });
    }
    for (const [index, s] of data.students.entries()) {
      const _id = id(), number = String(index + 1).padStart(3, '0');
      studentIds.set(s.studentId, _id);
      users.push({ _id, name: `Demo Student ${number}`, email: `student${number}@example.test`, studentId: s.studentId,
        advisor: advisorIds.get(config.advisorAssignments[s.studentId]), role: 'student', active: true, passwordHash });
    }
    const courses = [...data.courses].map(([code, title]) => ({ _id: id(), code, title, credits: config.credits[code] }));
    const courseIds = new Map(courses.map(c => [c.code, c._id]));
    const terms = [...data.terms].sort().map(code => ({ _id: id(), code, isCurrent: code === currentTerm, isFinalised: code !== currentTerm }));
    const termIds = new Map(terms.map(t => [t.code, t._id]));
    const offerings = config.offerings.map(o => ({ _id: id(), course: courseIds.get(o.code), term: termIds.get(currentTerm), section: o.section, meetings: o.meetings.map(m => ({ day: m.day, startTime: m.startTime, endTime: m.endTime })), room: o.room, instructor: o.instructor, capacity: o.capacity, addDropOpen: false }));
    const offeringIds = new Map(config.offerings.map((o, i) => [o.code, offerings[i]._id]));
    const records = data.attempts.filter(a => a.grade !== 'IP').map(a => ({ _id: id(), student: studentIds.get(a.studentId), course: courseIds.get(a.code), term: termIds.get(a.term), grade: a.grade }));
    const registrations = data.attempts.filter(a => a.grade === 'IP').map(a => ({ _id: id(), student: studentIds.get(a.studentId), offering: offeringIds.get(a.code), status: 'registered', createdAt: new Date() }));
    // Data was validated above. Separate application Mongoose models are still required.
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    await db.collection('users').createIndex({ studentId: 1 }, { unique: true, partialFilterExpression: { studentId: { $type: 'string' } } });
    for (const name of ['courses', 'terms']) await db.collection(name).createIndex({ code: 1 }, { unique: true });
    await db.collection('records').createIndex({ student: 1, course: 1, term: 1 }, { unique: true });
    await db.collection('offerings').createIndex({ course: 1, term: 1, section: 1 }, { unique: true });
    await db.collection('registrations').createIndex({ student: 1, offering: 1 }, { unique: true, partialFilterExpression: { status: 'registered' } });
    for (const [name, docs] of Object.entries({ users, courses, terms, offerings, records, registrations })) {
      if (docs.length) await db.collection(name).insertMany(docs);
      assert(await db.collection(name).countDocuments() === docs.length, `${name}: verification failed.`);
      console.log(`${name}: ${docs.length}`);
    }
    console.log('Import complete in the new development database.');
  } finally { await mongoose.disconnect(); }
}
async function main() {
  const args = process.argv.slice(2);
  assert(args.every(a => ['--preview', '--apply'].includes(a)) && !(args.includes('--preview') && args.includes('--apply')), 'Use --preview OR --apply.');
  const data = readData(), configFile = path.join(__dirname, 'seed-config.json');
  console.log(JSON.stringify({ students: data.students.length, advisors: data.advisors.length, courses: data.courses.size, terms: [...data.terms].sort(), historicalRecords: data.attempts.filter(a => a.grade !== 'IP').length, ipEntries: data.attempts.filter(a => a.grade === 'IP').length, grades: data.attempts.reduce((out, a) => { out[a.grade] = (out[a.grade] || 0) + 1; return out; }, {}) }, null, 2));
  assert(fs.existsSync(configFile), 'Place the updated seed-config.json beside seed.cjs.');
  const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  validateConfig(data, config);
  console.log('Configuration passed: four hours weekly, valid paired days, consistent course patterns, no student/room/instructor clashes.');
  if (!args.includes('--apply')) { console.log('PREVIEW ONLY: no database connection or database writes.'); return; }
  await importData(data, config);
}
module.exports = { validateMeetings, validatePatterns, clashes, validateConfig };
if (require.main === module) main().catch(err => {
  console.error(err.name === 'Error' ? err.message : `Failed (${err.name}); check local configuration and Atlas access.`);
  if (process.argv.includes('--apply')) console.error('If writing began, the new development database may be partial. No existing database is deleted by this script.');
  process.exitCode = 1;
});

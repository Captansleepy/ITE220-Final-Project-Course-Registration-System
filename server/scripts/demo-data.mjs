import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import User from '../src/models/User.js';
import Course from '../src/models/Course.js';
import Term from '../src/models/Term.js';
import Record from '../src/models/Record.js';
import Offering from '../src/models/Offering.js';
import Registration from '../src/models/Registration.js';
import { offeringEligibility, meetingsClash } from '../src/utils/registrationRules.js';
import { parseOfferingInput } from '../src/controllers/offeringController.js';
export const models = [User, Course, Term, Record, Offering, Registration];
export async function buildDemo(now = new Date()) {
  const oid = () => new mongoose.Types.ObjectId();
  const courses = [
    ['CSC220', 'Web Development II'], ['ENG103', 'College English III'],
    ['ITE102', 'Discrete Mathematics Structure'], ['ITE254', 'Human Computer Interaction'],
    ['ITE321', 'System Analysis, Design and Implementation'], ['ITE475', 'Network I'],
    ['MAT101', 'College of Algebra I'], ['STA101', 'Introduction to Statistics'], ['THA101', 'Elementary Thai I'],
  ].map(([code,title]) => ({_id:oid(),code,title,credits:4,description:'Fictional demonstration offering; curriculum title retained.'}));
  const year = now.getUTCFullYear();
  const terms = [
    {_id:oid(),code:`${year-1}-2`,isCurrent:false,isFinalised:true},
    {_id:oid(),code:`${year-1}-3`,isCurrent:false,isFinalised:true},
    {_id:oid(),code:`${year}-1`,isCurrent:true,isFinalised:false},
  ];
  const users = [
    {_id:oid(),name:'Demo Administrator',email:'admin@example.test',role:'admin',active:true},
    {_id:oid(),name:'Demo Advisor One',email:'advisor001@example.test',role:'advisor',active:true},
    {_id:oid(),name:'Demo Advisor Two',email:'advisor002@example.test',role:'advisor',active:true},
  ];
  for(let n=1;n<=25;n++) users.push({_id:oid(),name:`Demo Student ${String(n).padStart(3,'0')}`,email:`student${String(n).padStart(3,'0')}@example.test`,studentId:`DEMO${String(n).padStart(3,'0')}`,role:'student',advisor:users[n<=13?1:2]._id,active:n!==25});
  const students=users.filter(u=>u.role==='student');
  const schedules=[
    [['Monday','08:30','10:30'],['Thursday','08:30','10:30']],
    [['Monday','10:30','12:30'],['Thursday','10:30','12:30']],
    [['Monday','12:30','16:30']], [['Tuesday','08:30','12:30']],
    [['Tuesday','12:30','16:30']], [['Wednesday','08:30','12:30']],
    [['Wednesday','12:30','16:30']], [['Thursday','12:30','16:30']], [['Friday','08:30','12:30']],
  ];
  const offerings=courses.map((course,i)=>({_id:oid(),course:course._id,term:terms[2]._id,section:1,meetings:schedules[i].map(([day,startTime,endTime])=>({day,startTime,endTime})),room:'Demo Room 301',instructor:`Demo Instructor ${i+1}`,capacity:i===8?1:30,addDropOpen:i===0,addDropClosesAt:i===0?new Date(now.getTime()+7*86400000):null}));
  // Alternate section creates an intentional student-clash choice, using a different room/instructor.
  offerings.push({...offerings[3],_id:oid(),section:2,room:'Demo Room 302',instructor:'Demo Instructor 10',meetings:schedules[0].map(([day,startTime,endTime])=>({day,startTime,endTime}))});
  const records=[];
  const addRecord=(s,c,t,grade)=>records.push({_id:oid(),student:students[s]._id,course:courses[c]._id,term:terms[t]._id,grade});
  addRecord(0,2,0,'A'); addRecord(0,3,0,'F'); addRecord(0,4,1,'W'); addRecord(0,5,1,'D');
  addRecord(1,6,0,'F'); addRecord(1,6,1,'B');
  for(let s=2;s<25;s++) {addRecord(s,2,0,['A','B+','B','C+','C','D+','D'][s%7]);addRecord(s,5,1,s%3===0?'W':'B');}
  const registrations=[];
  const addRegistration=(s,o,status='registered')=>registrations.push({_id:oid(),student:students[s]._id,offering:offerings[o]._id,status});
  addRegistration(0,0);addRegistration(0,1);addRegistration(1,8);addRegistration(2,6);addRegistration(3,7,'dropped');
  const data={users,courses,terms,records,offerings,registrations};
  await validateDemo(data);
  return data;
}
export function eligibilityFor(data, studentIndex, offeringIndex, omitRegistration) {
  const student=data.users.filter(u=>u.role==='student')[studentIndex];
  const populate=o=>({...o,course:data.courses.find(c=>c._id.equals(o.course)),term:data.terms.find(t=>t._id.equals(o.term))});
  const registrations=data.registrations.filter(r=>r.status==='registered' && r.student.equals(student._id) && r!==omitRegistration).map(r=>({...r,offering:populate(data.offerings.find(o=>o._id.equals(r.offering)))}));
  const offering=data.offerings[offeringIndex];
  const seats=data.registrations.filter(r=>r.status==='registered' && r.offering.equals(offering._id) && r!==omitRegistration).length;
  return offeringEligibility(populate(offering),data.records.filter(r=>r.student.equals(student._id)),registrations,seats);
}
export async function validateDemo(data) {
  for(const [i,key] of ['users','courses','terms','records','offerings','registrations'].entries()) for(const row of data[key]) {
    await new models[i]({...row,passwordHash:'preview-only-placeholder'}).validate();
  }
  assert.equal(data.terms.filter(t=>t.isCurrent).length,1);
  for(const u of data.users.filter(u=>u.role==='student')) assert(data.users.some(a=>a._id.equals(u.advisor)&&a.role==='advisor'&&a.active));
  for(const r of data.records) {assert(data.users.some(u=>u._id.equals(r.student)&&u.role==='student'));assert(data.courses.some(c=>c._id.equals(r.course)));assert(data.terms.some(t=>t._id.equals(r.term)&&!t.isCurrent));}
  for(const o of data.offerings) parseOfferingInput({courseId:String(o.course),termId:String(o.term),section:o.section,meetings:o.meetings,room:o.room,instructor:o.instructor,capacity:o.capacity});
  for(let i=0;i<data.offerings.length;i++) for(let j=i+1;j<data.offerings.length;j++) {const a=data.offerings[i],b=data.offerings[j]; if(a.room===b.room||a.instructor===b.instructor) assert(!meetingsClash(a.meetings,b.meetings),'Room/instructor clash');}
  for(const r of data.registrations.filter(r=>r.status==='registered')) {
    const students=data.users.filter(u=>u.role==='student');
    const result=eligibilityFor(data,students.findIndex(s=>s._id.equals(r.student)),data.offerings.findIndex(o=>o._id.equals(r.offering)),r);
    assert(result.eligible,`Invalid seeded registration: ${result.reason}`);
  }
  for(const key of ['records','registrations']) {const seen=new Set();for(const r of data[key]) {const value=key==='records'?`${r.student}/${r.course}/${r.term}`:`${r.student}/${r.offering}`;assert(!seen.has(value),'Duplicate record');seen.add(value);}}
}

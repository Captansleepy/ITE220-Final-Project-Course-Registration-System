import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url)).replace(/\/$/,'');
const require=createRequire(root+'/package.json');
const mongoose=require('mongoose');
const dbName='portal_req_check_'+randomBytes(8).toString('hex');
process.env.MONGODB_DB_NAME=dbName;
const {default:connectDB}=await import(root+'/src/config/db.js');
const {default:app}=await import(root+'/src/app.js');
const {default:Request}=await import(root+'/src/models/AddDropRequest.js');
const {buildDemo,models}=await import(root+'/scripts/demo-data.mjs');
const {createToken}=await import(root+'/src/utils/auth.js');
const [User,Course,Term,Record,Offering,Registration]=models;
let server,created=false;
try {
 await connectDB();
 assert.equal((await mongoose.connection.db.listCollections().toArray()).length,0);created=true;
 const data=await buildDemo();for(const u of data.users)u.passwordHash='unused-test-login-hash';
 for(const [i,key]of Object.keys(data).entries())await models[i].insertMany(data[key]);
 for(const m of [...models,Request])await m.createIndexes();
 server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const base=`http://127.0.0.1:${server.address().port}/api`;
 const students=data.users.filter(u=>u.role==='student');
 const student=students[0],advisor=data.users[1],other=data.users[2];
 async function call(user,path,method='GET',body){const response=await fetch(base+path,{method,headers:{Authorization:`Bearer ${createToken(user,process.env.JWT_SECRET)}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const json=await response.json();return{...json,status:response.status};}
 const window=async(o,open=true)=>{const r=await call(advisor,`/advisor/offerings/${o._id}/add-drop`,'PATCH',{addDropOpen:open,...(open?{addDropClosesAt:new Date(Date.now()+86400000).toISOString()}:{})});assert.equal(r.status,200);};
 const submit=(u,o,action='add')=>call(u,'/student/requests','POST',{offeringId:String(o._id),action,reason:'Fictional automated workflow check.'});
 const review=(u,id,decision='approved')=>call(u,`/advisor/requests/${id}/review`,'POST',{decision,response:decision==='rejected'?'Not available for this test.':''});
 const o=data.offerings[3];
 assert.equal((await submit(student,o)).error.code,'WINDOW_CLOSED');await window(o);
 const r=await submit(student,o);assert.equal(r.status,201);const id=r.request.id;
 assert.equal((await submit(student,o)).error.code,'REQUEST_EXISTS');
 assert.equal(await Registration.countDocuments({student:student._id,offering:o._id,status:'registered'}),0);
 assert.equal((await call(student,'/student/requests')).requests[0].status,'pending');
 assert.equal((await call(other,'/advisor/requests')).pendingCount,0);
 assert.equal((await review(other,id)).status,404);
 assert.equal((await call(students[1],`/student/requests/${id}/cancel`,'POST',{})).status,404);
 const approvals=await Promise.all([review(advisor,id),review(advisor,id)]);assert.deepEqual(approvals.map(r=>r.status),[200,200]);
 assert.equal(await Registration.countDocuments({student:student._id,offering:o._id,status:'registered'}),1);
 assert((await call(student,'/student/dashboard')).registrations.some(r=>r.courseCode==='ITE254'));
 const drop1=await submit(student,o,'drop');assert.equal(drop1.status,201);assert.equal((await review(advisor,drop1.request.id,'rejected')).status,200);
 assert.equal(await Registration.countDocuments({student:student._id,offering:o._id,status:'registered'}),1);
 const cancel=await submit(student,o,'drop');assert.equal((await call(student,`/student/requests/${cancel.request.id}/cancel`,'POST',{})).status,200);assert.equal((await review(advisor,cancel.request.id)).status,409);
 const drop2=await submit(student,o,'drop');assert.equal((await review(advisor,drop2.request.id)).status,200);
 assert(!(await call(student,'/student/dashboard')).registrations.some(r=>r.courseCode==='ITE254'));
 // Two requests compete for exactly one remaining seat.
 const full=data.offerings[8];await window(full);await Offering.updateOne({_id:full._id},{$set:{capacity:2}});
 const a=await submit(students[3],full),b=await submit(students[4],full);assert.equal(a.status,201);assert.equal(b.status,201);
 const race=await Promise.all([review(advisor,a.request.id),review(advisor,b.request.id)]);assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);assert.equal(await Registration.countDocuments({offering:full._id,status:'registered'}),2);
 const pending=await Request.findOne({_id:{$in:[a.request.id,b.request.id]},status:'pending'}).lean();assert(pending);
 // Expired request cannot be approved.
 const sta=data.offerings[7];await window(sta);const expired=await submit(student,sta);assert.equal(expired.status,201);await Offering.updateOne({_id:sta._id},{$set:{addDropClosesAt:new Date(0)}});assert.equal((await review(advisor,expired.request.id)).error.code,'WINDOW_CLOSED');
 // Current advisor assignment, rather than stale submission assignment, controls access.
 const transfer=data.offerings[4];await window(transfer);const tr=await submit(students[2],transfer);assert.equal(tr.status,201);await User.updateOne({_id:students[2]._id},{$set:{advisor:other._id}});assert.equal((await review(advisor,tr.request.id)).status,404);assert.equal((await review(other,tr.request.id)).status,200);
 console.log('PASS: real Atlas submission, deduplication, role/ownership scopes, repeated approval, rejection, cancellation, add/drop dashboard updates, concurrent last-seat approvals, expiry and advisor reassignment.');
} catch(error) {
 const safe=String(error.message).replace(/mongodb(?:\+srv)?:\/\/[^\s]+/g,'[connection redacted]'); console.error('Isolated request check failed:',error.name,error.code??'',safe.slice(0,300));process.exitCode=1;
} finally {
 if(server)await new Promise(r=>{server.close(r);server.closeAllConnections();});
 if(created&&mongoose.connection.name===dbName&&dbName.startsWith('portal_req_check_')) {await mongoose.connection.dropDatabase();console.log('Removed temporary test database.');}
 await mongoose.disconnect();
}

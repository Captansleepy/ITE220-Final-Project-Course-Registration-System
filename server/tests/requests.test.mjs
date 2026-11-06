import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequestController,parseRequest,parseDecision,requireOpenWindow} from '../src/controllers/requestController.js';
const sid='111111111111111111111111',oid='222222222222222222222222',aid='333333333333333333333333',rid='444444444444444444444444',other='555555555555555555555555',cid='666666666666666666666666',tid='777777777777777777777777';
function fixture() {
 const state={student:{_id:sid,role:'student',advisor:aid,active:true},advisor:{_id:aid,role:'advisor',active:true},offering:{_id:oid,course:{_id:cid,code:'CSC220',title:'Web',credits:4},term:{_id:tid,code:'2026-1',isCurrent:true,isFinalised:false},capacity:1,section:1,room:'Room',instructor:'Instructor',meetings:[{day:'Monday',startTime:'08:30',endTime:'12:30'}],addDropOpen:true,addDropClosesAt:new Date(Date.now()+86400000)},requests:[],registrations:[],records:[],breakResolve:false};
 const q=value=>({session(){return this;},populate(){return this;},select(){return this;},sort(){return this;},limit(){return this;},lean:async()=>value,then(resolve,reject){return Promise.resolve(value).then(resolve,reject);}});
 const matches=(row,filter)=>Object.entries(filter).every(([k,v])=>String(row[k])===String(v));
 let queue=Promise.resolve();
 const transaction=callback=>{
   const result=queue.then(async()=>{const snapshot=structuredClone(state);try{return await callback({});}catch(e){Object.assign(state,snapshot);throw e;}});queue=result.catch(()=>{});return result;
 };
 const User={findOne:f=>q(f.role==='advisor'?(matches(state.advisor,f)?state.advisor:null):(matches(state.student,f)?state.student:null)),findOneAndUpdate:f=>q(matches(state.student,f)?state.student:null),find:f=>q(matches(state.student,f)?[state.student]:[])};
 const Record={find:()=>q(state.records)};
 const Offering={findById:id=>q(id===oid?state.offering:null),updateOne:async()=>({modifiedCount:1})};
 const Term={findOneAndUpdate:()=>q(state.offering.term.isCurrent&&!state.offering.term.isFinalised?state.offering.term:null)};
 const Registration={
  find:f=>q(state.registrations.filter(r=>matches(r,f)).map(r=>({...r,offering:state.offering}))),
  countDocuments:f=>q(state.registrations.filter(r=>matches(r,f)).length),
  findOne:f=>q(state.registrations.find(r=>matches(r,f))??null),
  findOneAndUpdate:(f,u)=>{const r=state.registrations.find(r=>matches(r,f));if(r)Object.assign(r,u.$set);return q(r);},
  create:async([r])=>{const doc={...r,_id:rid};state.registrations.push(doc);return[doc];},
  updateOne:async(f,u)=>{const r=state.registrations.find(r=>matches(r,f));if(r)Object.assign(r,u.$set);return{modifiedCount:r?1:0};},
 };
 const Request={findOne:f=>q(state.requests.find(r=>matches(r,f))??null),findById:id=>q(state.requests.find(r=>r._id===id)??null),create:async([r])=>{const row={...r,_id:other,status:'pending'};state.requests.push(row);return[row];},updateOne:async(f,u)=>{if(state.breakResolve)throw new Error('Storage failure');const row=state.requests.find(r=>matches(r,f));if(row)Object.assign(row,u.$set);return{modifiedCount:row?1:0};}};
 const controller=createRequestController({User,Record,Offering,Registration,Term,AddDropRequest:Request,transaction});
 const call=async(action,overrides={})=>{
   const req={user:{_id:action==='review'?aid:sid,role:action==='review'?'advisor':'student'},params:{requestId:other},body:action==='submit'?{action:'add',offeringId:oid,reason:'Please add this course.'}:{decision:'approved',response:''},...overrides};
   const result={status:200};const res={status(code){result.status=code;return this;},json(data){result.body=data;}};
   await controller[action](req,res,error=>{throw error;});return result;
 };
 return{state,call,models:{User,Record,Offering,Registration,Term,AddDropRequest:Request,transaction}};
}
test('request input rejects injected identities, missing reason, invalid action and malformed decisions',()=>{
 for(const body of [{action:'add',offeringId:oid,reason:'short',student:other},{action:'update',offeringId:oid,reason:'valid reason'},{action:'add',offeringId:{$ne:null},reason:'valid reason'},{action:'add',offeringId:oid,reason:'   '}])assert.throws(()=>parseRequest(body));
 assert.throws(()=>parseDecision({decision:'rejected',response:''}));assert.throws(()=>parseDecision({decision:'approved',response:'ok',student:sid}));
 assert.equal(parseRequest({action:'drop',offeringId:oid,reason:'  A valid reason  '}).reason,'A valid reason');
});
test('effective request window requires flag, future deadline and current nonfinalised term',()=>{
 const {state}=fixture();requireOpenWindow(state.offering);
 for(const patch of [{addDropOpen:false},{addDropClosesAt:null},{addDropClosesAt:'invalid'},{addDropClosesAt:new Date(0)},{term:{isCurrent:false}},{term:{isCurrent:true,isFinalised:true}}])assert.throws(()=>requireOpenWindow({...state.offering,...patch}));
});
test('submission saves pending state without reserving a seat and rejects duplicate submissions',async()=>{
 const {state,call}=fixture();assert.equal((await call('submit')).status,201);assert.equal(state.requests.length,1);assert.equal(state.registrations.length,0);
 assert.equal((await call('submit')).body.error.code,'REQUEST_EXISTS');assert.equal(state.requests.length,1);
});
test('wrong advisor cannot approve, and reassignment transfers access to current advisor',async()=>{
 const {state,call}=fixture();await call('submit');
 assert.equal((await call('review',{user:{_id:other,role:'advisor'}})).status,404);assert.equal(state.registrations.length,0);
 state.student.advisor=other;assert.equal((await call('review')).status,404);
 assert.equal((await call('review',{user:{_id:other,role:'advisor'}})).status,200);assert.equal(state.requests[0].reviewedBy,other);
});
test('approval creates registration and is idempotent on repeated approval',async()=>{
 const {state,call}=fixture();await call('submit');assert.equal((await call('review')).status,200);assert.equal(state.registrations.length,1);assert.equal(state.requests[0].status,'approved');
 assert.equal((await call('review')).status,200);assert.equal(state.registrations.length,1);
 assert.equal((await call('cancel')).status,409);
});
test('approval reruns capacity, grade, timetable, active-student and deadline checks',async()=>{
 for(const [change,code] of [
  [s=>s.registrations.push({_id:rid,student:other,offering:oid,status:'registered'}),'OFFERING_FULL'],
  [s=>s.records.push({student:sid,course:cid,grade:'D'}),'ALREADY_PASSED'],
  [s=>s.registrations.push({_id:rid,student:sid,offering:oid,status:'registered'}),'ALREADY_REGISTERED'],
  [s=>s.student.active=false,'STUDENT_INACTIVE'],
  [s=>s.offering.addDropClosesAt=new Date(0),'WINDOW_CLOSED'],
  [s=>s.offering.term.isFinalised=true,'TERM_CLOSED'],
 ]) {const {state,call}=fixture();await call('submit');change(state);const before=structuredClone(state.registrations);assert.equal((await call('review')).body.error.code,code);assert.equal(state.requests[0].status,'pending');assert.deepEqual(state.registrations,before);}
});
test('storage failure rolls back approved registration and request status together',async()=>{
 const {state,call}=fixture();await call('submit');state.breakResolve=true;await assert.rejects(()=>call('review'),/Storage failure/);assert.equal(state.registrations.length,0);assert.equal(state.requests[0].status,'pending');
 state.breakResolve=false;assert.equal((await call('review')).status,200);
});
test('cancel and reject preserve registrations; rejection requires an explanation',async()=>{
 const {state,call}=fixture();await call('submit');await call('cancel');assert.equal(state.requests[0].status,'cancelled');assert.equal((await call('review')).status,409);assert.equal(state.registrations.length,0);
 const f=fixture();await f.call('submit');f.state.offering.addDropOpen=false;
 assert.equal((await f.call('review',{body:{decision:'rejected',response:'The deadline is closed.'}})).status,200);assert.equal(f.state.requests[0].status,'rejected');assert.equal(f.state.registrations.length,0);
});
test('drop approval changes only the targeted active registration; second approval is harmless',async()=>{
 const {state,call}=fixture();state.registrations.push({_id:rid,student:sid,offering:oid,status:'registered'});
 assert.equal((await call('submit',{body:{offeringId:oid,action:'drop',reason:'I need to reduce my workload.'}})).status,201);
 assert.equal((await call('review')).status,200);assert.equal(state.registrations[0].status,'dropped');assert.equal(state.requests[0].status,'approved');assert.equal((await call('review')).status,200);
});
test('concurrent approve/cancel resolves once and leaves consistent registration state',async()=>{
 const {state,call}=fixture();await call('submit');const result=await Promise.all([call('review'),call('cancel')]);assert.deepEqual(result.map(r=>r.status),[200,409]);assert.equal(state.registrations.length,1);assert.equal(state.requests[0].status,'approved');
});

test('HTTP request endpoints require the matching role and scope request lists to the signed-in identity',async t=>{
 const {default:express}=await import('express');
 const {createStudentRoutes}=await import('../src/routes/studentRoutes.js');
 const {createAdvisorRoutes}=await import('../src/routes/advisorRoutes.js');
 const {createToken}=await import('../src/utils/auth.js');
 const {models}=fixture();const reads=[];
 const users={[sid]:{_id:sid,role:'student',active:true},[aid]:{_id:aid,role:'advisor',active:true},[other]:{_id:other,role:'admin',active:true}};
 models.User.findById=id=>({select:async()=>users[id]});
 models.AddDropRequest.find=filter=>{reads.push(filter);return{populate(){return this;},sort(){return this;},limit(){return this;},lean:async()=>[]};};
 models.AddDropRequest.countDocuments=async()=>0;
 const secret='request-http-test-secret-at-least-32-characters';
 const app=express();app.use(express.json());
 app.use('/api/student',createStudentRoutes(models.User,models.Record,models.Registration,secret,models));
 app.use('/api/advisor',createAdvisorRoutes(models.User,models.Record,secret,models));
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
 const call=(path,id)=>fetch(`http://127.0.0.1:${server.address().port}/api/${path}`,{headers:id?{Authorization:`Bearer ${createToken(users[id],secret)}`}:{}});
 assert.equal((await call('student/requests')).status,401);
 assert.equal((await call('student/requests',aid)).status,403);
 assert.equal((await call('advisor/requests',sid)).status,403);
 assert.equal((await call('advisor/requests',other)).status,403);
 assert.equal(reads.length,0);
 assert.equal((await call(`student/requests?student=${other}`,sid)).status,200);assert.deepEqual(reads[0],{student:sid});
 assert.equal((await call('advisor/requests',aid)).status,200);assert.deepEqual(reads[1],{student:{$in:[sid]}});
 users[sid].active=false;assert.equal((await call('student/requests',sid)).status,401);
});

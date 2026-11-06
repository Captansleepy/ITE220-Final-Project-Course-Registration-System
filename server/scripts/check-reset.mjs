// Real Atlas check for password recovery.
// Uses a brand-new temporary database (portal_reset_check_<random>) and deletes it at the end.
// Emails are kept in memory (MAIL_TRANSPORT=memory); nothing is really sent.
// Passwords and tokens are random and never printed.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url)).replace(/\/$/,'');
const require=createRequire(root+'/package.json');
const mongoose=require('mongoose');
const bcrypt=require('bcryptjs');
const dbName='portal_reset_check_'+randomBytes(8).toString('hex');
process.env.MONGODB_DB_NAME=dbName;
process.env.MAIL_TRANSPORT='memory';
const {default:connectDB}=await import(root+'/src/config/db.js');
const {default:app}=await import(root+'/src/app.js');
const {default:PasswordResetToken}=await import(root+'/src/models/PasswordResetToken.js');
const {sentEmails}=await import(root+'/src/utils/mailer.js');
const {buildDemo,models}=await import(root+'/scripts/demo-data.mjs');
const [User]=models;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let server,created=false;
try {
 await connectDB();
 assert.equal((await mongoose.connection.db.listCollections().toArray()).length,0);created=true;
 const data=await buildDemo();
 const oldPassword='Old-'+randomBytes(12).toString('hex');
 const oldHash=await bcrypt.hash(oldPassword,4);
 for(const u of data.users)u.passwordHash=oldHash;
 for(const [i,key]of Object.keys(data).entries())await models[i].insertMany(data[key]);
 for(const m of [...models,PasswordResetToken])await m.createIndexes();
 server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const base=`http://127.0.0.1:${server.address().port}/api`;
 const call=async(path,{token,method='GET',body}={})=>{const res=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});return{status:res.status,json:await res.json()};};
 const forgot=async email=>{const before=sentEmails.length;const r=await call('/auth/forgot-password',{method:'POST',body:{email}});for(let i=0;i<50&&sentEmails.length===before;i++)await wait(100);return r;};
 const tokenOf=e=>/#token=([a-f0-9]{64})$/m.exec(e.text)[1];
 const students=data.users.filter(u=>u.role==='student');
 const student=students.find(u=>u.active!==false), inactive=students.find(u=>u.active===false);

 // 1. Same reply for a real active account, an unknown email and an inactive account.
 const a=await forgot(student.email);
 const b=await call('/auth/forgot-password',{method:'POST',body:{email:'nobody@example.test'}});
 const c=await call('/auth/forgot-password',{method:'POST',body:{email:inactive.email}});
 assert.deepEqual([a.status,b.status,c.status],[202,202,202]);
 assert.deepEqual(a.json,b.json);assert.deepEqual(a.json,c.json);
 await wait(1500);
 assert.equal(sentEmails.length,1,'only the active account gets an email');
 assert.equal(sentEmails[0].to,student.email);
 // 2. Database holds only the hash.
 const token=tokenOf(sentEmails[0]);
 const rows=await PasswordResetToken.find({}).lean();
 assert.equal(rows.length,1);assert.equal(JSON.stringify(rows).includes(token),false);
 // 3. Logged-in session before reset.
 const first=await call('/auth/login',{method:'POST',body:{email:student.email,password:oldPassword}});assert.equal(first.status,200);
 // 4. Two resets with the same link at once: exactly one wins (real MongoDB atomic update).
 const p1='First-'+randomBytes(8).toString('hex'),p2='Second-'+randomBytes(8).toString('hex');
 const race=await Promise.all([call('/auth/reset-password',{method:'POST',body:{token,password:p1}}),call('/auth/reset-password',{method:'POST',body:{token,password:p2}})]);
 assert.deepEqual(race.map(r=>r.status).sort(),[200,400]);
 const winner=race[0].status===200?p1:p2, loser=winner===p1?p2:p1;
 assert.equal((await User.findById(student._id).lean()).sessionVersion,1);
 // 5. Old session ended; old and losing passwords refused; winning password works.
 assert.equal((await call('/auth/me',{token:first.json.token})).status,401);
 assert.equal((await call('/auth/login',{method:'POST',body:{email:student.email,password:oldPassword}})).status,401);
 assert.equal((await call('/auth/login',{method:'POST',body:{email:student.email,password:loser}})).status,401);
 const second=await call('/auth/login',{method:'POST',body:{email:student.email,password:winner}});assert.equal(second.status,200);
 assert.equal((await call('/student/dashboard',{token:second.json.token})).status,200);
 // 6. Link cannot be reused.
 assert.equal((await call('/auth/reset-password',{method:'POST',body:{token,password:'Reuse-'+randomBytes(8).toString('hex')}})).status,400);
 // 7. A newer link replaces an older one; an expired link is refused.
 await forgot(student.email);await forgot(student.email);
 const [older,newer]=sentEmails.slice(-2).map(tokenOf);
 assert.equal(await PasswordResetToken.countDocuments({usedAt:null}),1);
 assert.equal((await call('/auth/reset-password',{method:'POST',body:{token:older,password:'Older-'+randomBytes(8).toString('hex')}})).status,400);
 await PasswordResetToken.updateOne({usedAt:null},{$set:{expiresAt:new Date(Date.now()-1000)}});
 assert.equal((await call('/auth/reset-password',{method:'POST',body:{token:newer,password:'Late-'+randomBytes(8).toString('hex')}})).status,400);
 // 8. Real indexes exist: unique hash and automatic clean-up.
 const indexes=await PasswordResetToken.collection.indexes();
 assert(indexes.some(i=>i.key.tokenHash===1&&i.unique));
 assert(indexes.some(i=>i.key.expiresAt===1&&i.expireAfterSeconds===86400));
 console.log('PASS: same reply for active/unknown/inactive emails, only active gets a link, only hashes stored, concurrent reset has one winner, old session ended, old password refused, link single-use, newer link replaces older, expiry enforced, indexes present.');
} catch(error) {
 const safe=String(error.message).replace(/mongodb(?:\+srv)?:\/\/[^\s]+/g,'[connection redacted]').replace(/[a-f0-9]{64}/g,'[token redacted]');console.error('Reset check failed:',error.name,error.code??'',safe.slice(0,300));process.exitCode=1;
} finally {
 if(server)await new Promise(r=>{server.close(r);server.closeAllConnections();});
 if(created&&mongoose.connection.name===dbName&&dbName.startsWith('portal_reset_check_')){await mongoose.connection.dropDatabase();console.log('Removed temporary test database.');}
 await mongoose.disconnect();
}

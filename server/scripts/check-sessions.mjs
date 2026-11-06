// Real Atlas check: an admin password change logs the user out of old sessions.
// Uses a brand-new temporary database (portal_session_check_<random>) and deletes it at the end.
// Passwords are random and generated here; they are never printed.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url)).replace(/\/$/,'');
const require=createRequire(root+'/package.json');
const mongoose=require('mongoose');
const bcrypt=require('bcryptjs');
const dbName='portal_session_check_'+randomBytes(8).toString('hex');
process.env.MONGODB_DB_NAME=dbName;
const {default:connectDB}=await import(root+'/src/config/db.js');
const {default:app}=await import(root+'/src/app.js');
const {buildDemo,models}=await import(root+'/scripts/demo-data.mjs');
const {createToken}=await import(root+'/src/utils/auth.js');
const [User]=models;
let server,created=false;
try {
 await connectDB();
 assert.equal((await mongoose.connection.db.listCollections().toArray()).length,0);created=true;
 // Fill the temporary database with the fictional demo data.
 const data=await buildDemo();
 const oldPassword='Old-'+randomBytes(12).toString('hex'), newPassword='New-'+randomBytes(12).toString('hex');
 const oldHash=await bcrypt.hash(oldPassword,4);
 for(const u of data.users)u.passwordHash=oldHash;
 for(const [i,key]of Object.keys(data).entries())await models[i].insertMany(data[key]);
 for(const m of models)await m.createIndexes();
 server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const base=`http://127.0.0.1:${server.address().port}/api`;
 const call=async(path,{token,method='GET',body}={})=>{const res=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});return{status:res.status,json:await res.json()};};
 const login=(email,password)=>call('/auth/login',{method:'POST',body:{email,password}});
 const admin=data.users.find(u=>u.role==='admin');
 const students=data.users.filter(u=>u.role==='student'&&u.active!==false);
 const student=students[0], bystander=students[1];

 // 1. Student logs in for real and their session works.
 const first=await login(student.email,oldPassword);assert.equal(first.status,200,'student login');
 const oldToken=first.json.token;
 assert.equal((await call('/auth/me',{token:oldToken})).status,200);
 assert.equal((await call('/student/dashboard',{token:oldToken})).status,200);
 // Another student is also logged in; they must NOT be affected.
 const otherToken=(await login(bystander.email,oldPassword)).json.token;

 // 2. Admin changes the student's password through the real admin endpoint.
 const adminToken=createToken(admin,process.env.JWT_SECRET);
 const change=await call(`/admin/users/${student._id}`,{token:adminToken,method:'PATCH',body:{password:newPassword}});
 assert.equal(change.status,200,'admin password change');
 assert.equal((await User.findById(student._id).lean()).sessionVersion,1,'session version raised');

 // 3. The old session is ended everywhere.
 const me=await call('/auth/me',{token:oldToken});assert.equal(me.status,401);
 assert.equal((await call('/student/dashboard',{token:oldToken})).status,401);
 // 4. Old password no longer works; new one does, and its session works.
 assert.equal((await login(student.email,oldPassword)).status,401);
 const second=await login(student.email,newPassword);assert.equal(second.status,200);
 assert.equal((await call('/student/dashboard',{token:second.json.token})).status,200);
 // 5. A second change ends the second session too.
 assert.equal((await call(`/admin/users/${student._id}`,{token:adminToken,method:'PATCH',body:{password:oldPassword}})).status,200);
 assert.equal((await call('/auth/me',{token:second.json.token})).status,401);
 // 6. Editing something other than the password does NOT log the user out.
 const third=(await login(student.email,oldPassword)).json.token;
 assert.equal((await call(`/admin/users/${student._id}`,{token:adminToken,method:'PATCH',body:{name:'Renamed Demo Student'}})).status,200);
 assert.equal((await call('/auth/me',{token:third})).status,200);
 // 7. The other student was never logged out.
 assert.equal((await call('/student/dashboard',{token:otherToken})).status,200);
 console.log('PASS: real login, admin password change ends old sessions, old password refused, new password works, repeated changes, name-only edits keep the session, other users unaffected.');
} catch(error) {
 const safe=String(error.message).replace(/mongodb(?:\+srv)?:\/\/[^\s]+/g,'[connection redacted]');console.error('Session check failed:',error.name,error.code??'',safe.slice(0,300));process.exitCode=1;
} finally {
 if(server)await new Promise(r=>{server.close(r);server.closeAllConnections();});
 if(created&&mongoose.connection.name===dbName&&dbName.startsWith('portal_session_check_')){await mongoose.connection.dropDatabase();console.log('Removed temporary test database.');}
 await mongoose.disconnect();
}

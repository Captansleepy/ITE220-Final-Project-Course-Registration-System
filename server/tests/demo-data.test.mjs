import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDemo,eligibilityFor} from '../scripts/demo-data.mjs';
test('fictional demo exercises the real eligibility rules',async()=>{
 const d=await buildDemo(new Date('2026-10-28T00:00:00Z'));
 assert.equal(eligibilityFor(d,0,0).code,'ALREADY_REGISTERED');
 assert.equal(eligibilityFor(d,0,2).code,'ALREADY_PASSED');
 assert.equal(eligibilityFor(d,0,5).code,'ALREADY_PASSED'); // D is passing.
 assert.equal(eligibilityFor(d,0,3).retakeRequired,true);
 assert.equal(eligibilityFor(d,0,3).eligible,true); // unresolved F
 assert.equal(eligibilityFor(d,0,4).eligible,true); // W can repeat
 assert.equal(eligibilityFor(d,0,9).code,'TIMETABLE_CLASH');
 assert.equal(eligibilityFor(d,0,8).code,'OFFERING_FULL');
 assert.equal(eligibilityFor(d,1,6).retakeRequired,false); // F followed by pass
 assert.equal(eligibilityFor(d,1,6).code,'ALREADY_PASSED');
 assert.equal(eligibilityFor(d,3,7).eligible,true); // dropped row does not block
 assert.equal(d.users.filter(u=>u.role==='student'&&u.active).length,24);
 assert.equal(d.users.filter(u=>u.role==='student'&&String(u.advisor)===String(d.users[1]._id)).length,13);
});

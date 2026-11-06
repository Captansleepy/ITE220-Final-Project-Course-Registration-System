import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import connectDB from '../src/config/db.js';
import {buildDemo, models} from './demo-data.mjs';
const mode=process.argv[2];
if(!['--preview','--apply'].includes(mode)||process.argv.length!==3) throw new Error('Use --preview or --apply.');
const data=await buildDemo();
console.log('Fully fictional demo; no workbook or original histories read.');
for(const [key,rows] of Object.entries(data)) console.log(`${key}: ${rows.length}`);
console.log('Validated schema, advisors, four-hour schedules, room conflicts and active-registration eligibility.');
if(mode==='--apply') {
  if(process.env.MONGODB_DB_NAME!=='course_registration_seed_personal_dev') throw new Error('Demo seed only accepts course_registration_seed_personal_dev.');
  if(!process.env.SEED_PASSWORD || process.env.SEED_PASSWORD.length<12) throw new Error('Set SEED_PASSWORD to at least 12 characters.');
  try {
    await connectDB();
    // An existing collection also blocks retries after a partial import; never overwrite data.
    const collections=await mongoose.connection.db.listCollections({}, {nameOnly:true}).toArray();
    if(collections.length) throw new Error('Database is not empty. Nothing was overwritten; choose a fresh setup or inspect existing data.');
    const passwordHash=await bcrypt.hash(process.env.SEED_PASSWORD,12);
    for(const user of data.users) user.passwordHash=passwordHash;
    await mongoose.connection.transaction(async session=>{
      for(const [i,key] of Object.keys(data).entries()) await models[i].insertMany(data[key],{session});
    });
    for(const model of models) await model.createIndexes();
    console.log('Demo saved. Login with admin@example.test, advisor001@example.test or student001@example.test and your SEED_PASSWORD.');
  } finally {await mongoose.disconnect();}
}

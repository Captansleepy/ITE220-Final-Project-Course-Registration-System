import mongoose from 'mongoose';
import {createRegistrationController} from './registrationController.js';
import {fail,RegistrationError,offeringEligibility,publicOffering} from '../utils/registrationRules.js';
export function requireOpenWindow(o, now=Date.now()) {
  if(!o?.term?.isCurrent || o.term.isFinalised) fail(409,'TERM_CLOSED','The term is closed.');
  if(!o.addDropOpen || !o.addDropClosesAt || new Date(o.addDropClosesAt).getTime()<=now || !Number.isFinite(new Date(o.addDropClosesAt).getTime())) fail(409,'WINDOW_CLOSED','The Add/Drop window is closed. Ask your advisor about the deadline.');
}
export function parseRequest(body) {
  if(!body || Object.keys(body).some(k=>!['offeringId','action','reason'].includes(k)) || !mongoose.isObjectIdOrHexString(body.offeringId) || !['add','drop'].includes(body.action) || typeof body.reason!=='string' || body.reason.trim().length<5 || body.reason.trim().length>1000) fail(400,'INVALID_INPUT','Choose add or drop, a valid offering, and a reason of 5–1000 characters.');
  return {offering:body.offeringId,action:body.action,reason:body.reason.trim()};
}
export function parseDecision(body) {
  if(!body || Object.keys(body).some(k=>!['decision','response'].includes(k)) || !['approved','rejected'].includes(body.decision) || typeof body.response!=='string' || body.response.trim().length>1000 || (body.decision==='rejected' && body.response.trim().length<5)) fail(400,'INVALID_INPUT','Choose approve or reject. Rejections need a response of 5–1000 characters.');
  return {status:body.decision,response:body.response.trim()};
}
export function createRequestController(models) {
  const {User,Record,Offering,Registration,Term,AddDropRequest:Request}=models;
  const transaction=models.transaction ?? (callback=>mongoose.connection.transaction(callback));
  const registration=createRegistrationController({...models,transaction});
  const valid=id=>{if(!mongoose.isObjectIdOrHexString(id)) fail(400,'INVALID_ID','Invalid request ID.');};
  const wrap=fn=>async(req,res,next)=>{try {await fn(req,res);}catch(e){if(e instanceof RegistrationError) return res.status(e.status).json({error:{code:e.code,message:e.message}});if(e.code===11000) return res.status(409).json({error:{code:'REQUEST_EXISTS',message:'A pending request already exists for this offering.'}});next(e);}};
  const getOffering=(id,session)=>Offering.findById(id).session(session??null).populate('course').populate('term').lean();
  const active=(student,session)=>Registration.find({student,status:'registered'}).session(session??null).populate({path:'offering',populate:[{path:'course'},{path:'term'}]}).lean();
  const touchStudent=async(id,advisor,session)=>{
    const student=await User.findOneAndUpdate({_id:id,role:'student',...(advisor?{advisor}:{})},{$set:{updatedAt:new Date()}},{returnDocument:'after',session}).lean();
    if(!student) fail(404,'REQUEST_NOT_FOUND','Request or assigned student not found.');
    return student;
  };
  const assertActive=student=>{if(!student.active) fail(409,'STUDENT_INACTIVE','The student account is inactive.');};
  const lockWindow=async(o,session)=>{
    requireOpenWindow(o);
    const term=await Term.findOneAndUpdate({_id:o.term._id,isCurrent:true,isFinalised:false},{$inc:{registrationRevision:1}},{returnDocument:'after',session});
    if(!term) fail(409,'TERM_CLOSED','The term is closed.');
    await Offering.updateOne({_id:o._id},{$set:{updatedAt:new Date()}},{session});
  };
  const serialise=row=>({id:String(row._id),student:row.student?{id:String(row.student._id),name:row.student.name,studentId:row.student.studentId}:null,offering:row.offering?.course&&row.offering?.term?publicOffering(row.offering):null,action:row.action,reason:row.reason,status:row.status,response:row.response,createdAt:row.createdAt,resolvedAt:row.resolvedAt,reviewedBy:row.reviewedBy?.name??null});
  return {
    options:wrap(async(req,res)=>{
      const terms=await Term.find({isCurrent:true,isFinalised:false}).lean();
      const offerings=await Offering.find({term:{$in:terms.map(t=>t._id)}}).populate('course').populate('term').lean();
      const records=await Record.find({student:req.user._id}).lean();
      const registrations=await active(req.user._id);
      const pending=await Request.find({student:req.user._id,status:'pending'}).lean();
      const result=[];
      for(const o of offerings) {
        let open=true;try{requireOpenWindow(o);}catch{open=false;}
        const used=await Registration.countDocuments({offering:o._id,status:'registered'});
        const rule=offeringEligibility(o,records,registrations,used);
        result.push({...publicOffering(o),...rule,windowOpen:open,registered:registrations.some(r=>String(r.offering?._id)===String(o._id)),pending:pending.some(r=>String(r.offering)===String(o._id))});
      }
      res.json({offerings:result.sort((a,b)=>a.courseCode.localeCompare(b.courseCode)||a.section-b.section)});
    }),
    list:wrap(async(req,res)=>{
      const filter=req.user.role==='student'?{student:req.user._id}:{student:{$in:(await User.find({role:'student',advisor:req.user._id}).select('_id').lean()).map(u=>u._id)}};
      const requests=await Request.find(filter).populate('student','name studentId').populate('reviewedBy','name').populate({path:'offering',populate:[{path:'course'},{path:'term'}]}).sort({createdAt:-1}).limit(200).lean();
      res.json({requests:requests.map(serialise),pendingCount:await Request.countDocuments({...filter,status:'pending'})});
    }),
    submit:wrap(async(req,res)=>{
      const input=parseRequest(req.body);let saved;
      await transaction(async session=>{
        const student=await touchStudent(req.user._id,null,session);assertActive(student);
        const advisor=await User.findOne({_id:student.advisor,role:'advisor',active:true}).session(session).lean();
        if(!advisor) fail(409,'ADVISOR_UNAVAILABLE','No active advisor is assigned. Contact your department.');
        const o=await getOffering(input.offering,session);if(!o) fail(404,'OFFERING_NOT_FOUND','Offering not found.');
        await lockWindow(o,session);
        const pending=await Request.findOne({student:student._id,offering:o._id,status:'pending'}).session(session).lean();
        if(pending) fail(409,'REQUEST_EXISTS','A pending request already exists for this offering.');
        if(input.action==='add') {
          const rule=offeringEligibility(o,await Record.find({student:student._id}).session(session).lean(),await active(student._id,session),await Registration.countDocuments({offering:o._id,status:'registered'}).session(session));
          if(!rule.eligible) fail(409,rule.code,rule.reason);
        }else if(!await Registration.findOne({student:student._id,offering:o._id,status:'registered'}).session(session).lean()) fail(409,'REGISTRATION_NOT_FOUND','You are not registered for this offering.');
        [saved]=await Request.create([{...input,student:student._id,submittedAdvisor:advisor._id}],{session});
      });
      res.status(201).json({request:{id:String(saved._id),status:saved.status}});
    }),
    cancel:wrap(async(req,res)=>{
      valid(req.params.requestId);
      await transaction(async session=>{
        await touchStudent(req.user._id,null,session);
        const row=await Request.findOne({_id:req.params.requestId,student:req.user._id}).session(session).lean();
        if(!row) fail(404,'REQUEST_NOT_FOUND','Request not found.');
        if(row.status==='cancelled') return;
        if(row.status!=='pending') fail(409,'REQUEST_RESOLVED','This request has already been reviewed.');
        await Request.updateOne({_id:row._id,status:'pending'},{$set:{status:'cancelled',resolvedAt:new Date()}},{session});
      });res.json({status:'cancelled'});
    }),
    review:wrap(async(req,res)=>{
      valid(req.params.requestId);const decision=parseDecision(req.body);
      await transaction(async session=>{
        const row=await Request.findById(req.params.requestId).session(session).lean();
        if(!row) fail(404,'REQUEST_NOT_FOUND','Request not found.');
        const student=await touchStudent(row.student,req.user._id,session);
        if(row.status!=='pending') {
          if(row.status===decision.status && String(row.reviewedBy)===String(req.user._id)) return;
          fail(409,'REQUEST_RESOLVED','This request has already been resolved.');
        }
        if(decision.status==='approved') {
          assertActive(student);
          const o=await getOffering(row.offering,session);if(!o) fail(409,'OFFERING_NOT_FOUND','Offering no longer exists. Reject this request.');
          await lockWindow(o,session);
          const context={user:req.user,params:{id:String(student._id)},body:{offeringId:String(o._id)}};
          if(row.action==='add') await registration.registerInSession(context,session);
          else {
            const current=await Registration.findOne({student:student._id,offering:o._id,status:'registered'}).session(session).lean();
            if(!current) fail(409,'REGISTRATION_NOT_FOUND','The registration is no longer active. Reject this request.');
            context.params.registrationId=String(current._id);
            await registration.dropInSession(context,session);
          }
        }
        await Request.updateOne({_id:row._id,status:'pending'},{$set:{...decision,reviewedBy:req.user._id,resolvedAt:new Date()}},{session,runValidators:true});
      });res.json({status:decision.status});
    }),
  };
}

import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  student: {type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},
  submittedAdvisor: {type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},
  offering: {type:mongoose.Schema.Types.ObjectId,ref:'Offering',required:true},
  action: {type:String,enum:['add','drop'],required:true},
  reason: {type:String,trim:true,minlength:5,maxlength:1000,required:true},
  status: {type:String,enum:['pending','approved','rejected','cancelled'],default:'pending',required:true},
  response: {type:String,trim:true,maxlength:1000,default:''},
  reviewedBy: {type:mongoose.Schema.Types.ObjectId,ref:'User'},
  resolvedAt: {type:Date},
}, {timestamps:true,autoCreate:false,autoIndex:false});
schema.index({student:1,offering:1},{unique:true,partialFilterExpression:{status:'pending'}});
schema.index({status:1,createdAt:-1});
export default mongoose.model('AddDropRequest',schema);

import mongoose from 'mongoose';

const termSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  isCurrent: {
    type: Boolean,
    default: false
  },
  registrationRevision: { type: Number, default: 0 },
  isFinalised: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

export default mongoose.models.Term || mongoose.model('Term', termSchema);
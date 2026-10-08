import mongoose from 'mongoose';

const registrationSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  offering: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Offering',
    required: true
  },
  status: {
    type: String,
    enum: ['registered', 'dropped'],
    default: 'registered',
    required: true
  }
}, { timestamps: true });

registrationSchema.index({ student: 1, offering: 1 }, { unique: true });

export default mongoose.models.Registration || mongoose.model('Registration', registrationSchema);
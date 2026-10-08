import mongoose from 'mongoose';

const recordSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  term: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Term',
    required: true
  },
  grade: {
    type: String,
    required: true,
    enum: ['A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'F', 'W'],
    uppercase: true
  }
}, { timestamps: true });

recordSchema.index({ student: 1, course: 1, term: 1 }, { unique: true });

export default mongoose.models.Record || mongoose.model('Record', recordSchema);
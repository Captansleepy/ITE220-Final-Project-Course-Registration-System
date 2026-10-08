import mongoose from 'mongoose';

const courseSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  credits: {
    type: Number,
    required: true,
    default: 4,
    validate: {
      validator: function(val) {
        return val === 4;
      },
      message: 'All courses must be 4 credits only.'
    }
  },
  description: {
    type: String,
    default: ''
  }
}, { timestamps: true });

export default mongoose.models.Course || mongoose.model('Course', courseSchema);
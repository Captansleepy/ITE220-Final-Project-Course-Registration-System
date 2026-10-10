import mongoose from 'mongoose';

const meetingSchema = new mongoose.Schema({
  day: {
    type: String,
    required: true,
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  },
  startTime: {
    type: String,
    required: true
  },
  endTime: {
    type: String,
    required: true
  }
}, { _id: false });

const offeringSchema = new mongoose.Schema({
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
  section: {
    type: Number,
    required: true
  },
  meetings: {
    type: [meetingSchema],
    required: true,
    validate: {
      validator: function(meetings) {
        if (!meetings || meetings.length === 0) return false;

        const parseMinutes = (timeStr) => {
          const [h, m] = timeStr.split(':').map(Number);
          return h * 60 + m;
        };

        const totalMinutes = meetings.reduce((sum, m) => {
          return sum + (parseMinutes(m.endTime) - parseMinutes(m.startTime));
        }, 0);

        if (totalMinutes !== 240) return false;

        if (meetings.length === 1) {
          const day = meetings[0].day;
          return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].includes(day);
        } else if (meetings.length === 2) {
          const [m1, m2] = meetings;
          const dur1 = parseMinutes(m1.endTime) - parseMinutes(m1.startTime);
          const dur2 = parseMinutes(m2.endTime) - parseMinutes(m2.startTime);

          if (dur1 !== 120 || dur2 !== 120) return false;
          if (m1.startTime !== m2.startTime || m1.endTime !== m2.endTime) return false;

          const pair1 = (m1.day === 'Monday' && m2.day === 'Thursday') || (m1.day === 'Thursday' && m2.day === 'Monday');
          const pair2 = (m1.day === 'Tuesday' && m2.day === 'Friday') || (m1.day === 'Friday' && m2.day === 'Tuesday');

          return pair1 || pair2;
        }

        return false;
      },
      message: 'The class schedule has to add up to 4 hours'
    }
  },
  room: {
    type: String,
    required: true
  },
  instructor: {
    type: String,
    required: true
  },
  capacity: {
    type: Number,
    required: true,
    min: 1
  },
  addDropClosesAt: { type: Date, default: null },
  addDropOpen: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

offeringSchema.index({ course: 1, term: 1, section: 1 }, { unique: true });

export default mongoose.models.Offering || mongoose.model('Offering', offeringSchema);
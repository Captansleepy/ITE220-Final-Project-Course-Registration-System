import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: /^[^\s@]+@[^\s@]+.[^\s@]+$/,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      required: true,
      enum: ["admin", "advisor", "student"],
    },
    studentId: {
      type: String,
      trim: true,
      required: function () {
        return this.role === "student";
      },
    },
    advisor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: function () {
        return this.role === "student";
      },
    },
    active: {
      type: Boolean,
      default: true,
      required: true,
    },
  },
  {
    collection: "users",
    timestamps: true,
    autoCreate: false,
    autoIndex: false,
  }
);

// Match the indexes already created by the seed.
userSchema.index({ email: 1 }, { unique: true });

userSchema.index(
  { studentId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      studentId: { $type: "string" },
    },
  }
);

export default mongoose.model("User", userSchema);
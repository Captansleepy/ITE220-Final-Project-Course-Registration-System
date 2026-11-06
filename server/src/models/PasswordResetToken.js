import mongoose from "mongoose";

// One row per "forgot password" link that was sent.
// We never store the real token, only a SHA-256 hash of it,
// so someone reading the database cannot use the links.
const passwordResetTokenSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    tokenHash: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    // Set when the link is used. A used link can never work again.
    usedAt: {
      type: Date,
      default: null,
    },
  },
  {
    collection: "passwordresettokens",
    timestamps: true,
    autoCreate: false,
    autoIndex: false,
  }
);

// Look up a link quickly by its hash; two links can never share a hash.
passwordResetTokenSchema.index({ tokenHash: 1 }, { unique: true });
// Find a user's older links so a new request can cancel them.
passwordResetTokenSchema.index({ user: 1 });
// MongoDB deletes rows automatically one day after they expire.
passwordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 86400 });

export default mongoose.models.PasswordResetToken ||
  mongoose.model("PasswordResetToken", passwordResetTokenSchema);

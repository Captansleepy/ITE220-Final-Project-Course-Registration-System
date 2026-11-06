import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { ROLES, authError } from "../utils/auth.js";
import { createLimiter } from "../utils/rateLimit.js";

const LINK_MINUTES = 30; // how long a reset link works
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOKEN_PATTERN = /^[a-f0-9]{64}$/; // 32 random bytes written as hex

// The same reply for every valid email, so nobody can use this page
// to find out which emails have accounts.
const REQUEST_REPLY = {
  message: `If an active account uses that email, we have sent a password reset link. The link works for ${LINK_MINUTES} minutes.`,
};

const BAD_LINK_MESSAGE = "This reset link is invalid, expired or already used. Please request a new one.";

// Turn the secret token into the hash we store in the database.
export function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export function createPasswordResetController({ User, PasswordResetToken, mailer, appUrl }) {
  // At most 3 emails per address per hour, even from different computers.
  const emailLimiter = createLimiter({ windowMs: 60 * 60 * 1000, max: 3 });
  // Work that runs after the reply has been sent (see forgotPassword).
  let backgroundJob = Promise.resolve();

  async function createAndSendLink(email) {
    const user = await User.findOne({ email });

    // Unknown, inactive or broken accounts get no link. Nothing tells the
    // person asking, because the reply was already sent.
    if (!user || user.active !== true || !ROLES.includes(user.role)) return;

    // Only the newest link should work, so cancel any older unused ones.
    await PasswordResetToken.deleteMany({ user: user._id, usedAt: null });

    const token = randomBytes(32).toString("hex");
    await PasswordResetToken.create({
      user: user._id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + LINK_MINUTES * 60 * 1000),
    });

    // The token goes after "#" so browsers never send it to any server
    // in the address or in the Referer header.
    const link = `${appUrl}/reset-password#token=${token}`;

    await mailer.send({
      to: user.email,
      subject: "Reset your Course Portal password",
      text:
        `Hello ${user.name},\n\n` +
        `Someone asked to reset the password for your Course Portal account.\n` +
        `Open this link within ${LINK_MINUTES} minutes to choose a new password:\n\n` +
        `${link}\n\n` +
        `If you did not ask for this, you can ignore this email. Your password stays the same.`,
    });
  }

  return {
    // POST /api/auth/forgot-password   body: { email }
    async forgotPassword(req, res) {
      const { email } = req.body || {};
      if (typeof email !== "string" || email.length > 254 || !EMAIL_PATTERN.test(email.trim())) {
        return authError(res, 400, "VALIDATION_ERROR", "Enter a valid email address.");
      }
      const normalized = email.trim().toLowerCase();

      // Reply straight away, before looking anything up. Then a registered
      // and an unknown email take the same time to answer.
      res.status(202).json(REQUEST_REPLY);

      // Too many requests for this email: quietly send nothing more.
      if (!emailLimiter.attempt(normalized)) return;

      backgroundJob = createAndSendLink(normalized).catch((error) => {
        // Log only the kind of error, never the token or email address.
        console.error("Could not create or send a password reset link:", error.name);
      });
    },

    // POST /api/auth/reset-password   body: { token, password }
    async resetPassword(req, res) {
      const { token, password } = req.body || {};

      if (typeof token !== "string" || !TOKEN_PATTERN.test(token)) {
        return authError(res, 400, "INVALID_RESET_LINK", BAD_LINK_MESSAGE);
      }
      if (typeof password !== "string" || password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
        return authError(res, 400, "VALIDATION_ERROR", "Password must be 8–72 bytes.");
      }

      // Use the link up in ONE database step: it must exist, be unused and
      // not expired, and it is marked used at the same moment. If two
      // requests arrive together, only one of them can win this step.
      const now = new Date();
      const used = await PasswordResetToken.findOneAndUpdate(
        { tokenHash: hashToken(token), usedAt: null, expiresAt: { $gt: now } },
        { $set: { usedAt: now } },
        { returnDocument: "after" }
      );
      if (!used) {
        return authError(res, 400, "INVALID_RESET_LINK", BAD_LINK_MESSAGE);
      }

      // Save the new password and raise sessionVersion, which logs the
      // user out of every old session (step 1). Inactive accounts are skipped.
      const passwordHash = await bcrypt.hash(password, 12);
      const result = await User.updateOne(
        { _id: used.user, active: true },
        { $set: { passwordHash }, $inc: { sessionVersion: 1 } }
      );
      if (result.modifiedCount !== 1) {
        return authError(res, 400, "INVALID_RESET_LINK", BAD_LINK_MESSAGE);
      }

      // Any other unused links for this account are no longer needed.
      await PasswordResetToken.deleteMany({ user: used.user, usedAt: null });

      return res.json({ message: "Your password has been changed. Please sign in with your new password." });
    },

    // Used by tests to wait for the email work that runs after the reply.
    whenIdle() {
      return backgroundJob;
    },
  };
}

import mongoose from "mongoose";

/**
 * A fixed MongoDB document serializes ALL admin user updates/deactivations.
 *
 * The guard is upserted before entering a transaction to avoid creating
 * collections inside a transaction on a freshly seeded database.
 * The write inside the transaction conflicts with any overlapping mutation.
 * MongoDB's transaction retry then reruns the last-admin check on a fresh
 * snapshot. Requires a replica set / Atlas transaction support.
 */
export async function withAdminMutationLock(callback, connection = mongoose.connection) {
  const guards = connection.db.collection("admin_mutation_guards");
  const guardId = "admin-accounts";

  try {
    await guards.updateOne(
      { _id: guardId },
      { $setOnInsert: { revision: 0 } },
      { upsert: true },
    );
  } catch (error) {
    // Competing requests may race to create the singleton. If another
    // request won the unique _id insert, the guard is already available.
    if (error?.code !== 11000) throw error;
  }

  return connection.transaction(async (session) => {
    const locked = await guards.updateOne(
      { _id: guardId },
      { $inc: { revision: 1 } },
      { session },
    );
    if (locked.matchedCount !== 1) {
      throw new Error("Admin mutation guard is unavailable.");
    }
    return callback(session);
  });
}

export class AdminMutationError extends Error {
  constructor(code, message, status = 409) {
    super(message);
    this.name = "AdminMutationError";
    this.code = code;
    this.status = status;
  }
}

/**
 * Call ONLY while the admin mutation lock is held, using the same session.
 */
export async function assertAdminRemovalAllowed(User, user, next, session) {
  if (user.role !== "admin" || user.active !== true ||
      (next.role === "admin" && next.active === true)) return;
  const count = await User.countDocuments({ role: "admin", active: true }).session(session);
  if (count <= 1) {
    throw new AdminMutationError("LAST_ADMIN", "The last active admin cannot be removed.");
  }
}

// A very small in-memory rate limiter.
// It counts attempts per "key" (for example an IP address) inside a time window.
// Counts are lost when the server restarts, which is fine for one local server.
// A hosted version with several servers would need a shared store instead.

export function createLimiter({ windowMs, max }) {
  const hits = new Map(); // key -> { count, resetAt }

  // Returns true if this attempt is allowed, false if the limit is reached.
  function attempt(key) {
    const now = Date.now();
    let entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }

    entry.count += 1;

    // Remove old entries now and then so the map does not grow forever.
    if (hits.size > 10000) {
      for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
    }

    return entry.count <= max;
  }

  // Seconds until the key may try again (used for the Retry-After header).
  function retryAfterSeconds(key) {
    const entry = hits.get(key);
    if (!entry) return 0;
    return Math.max(1, Math.ceil((entry.resetAt - Date.now()) / 1000));
  }

  return { attempt, retryAfterSeconds };
}

// Express middleware that limits requests per IP address.
export function limitByIp(limiter, message) {
  return (req, res, next) => {
    const key = req.ip || "unknown";
    if (limiter.attempt(key)) return next();
    res.set("Retry-After", String(limiter.retryAfterSeconds(key)));
    return res.status(429).json({
      error: { code: "TOO_MANY_REQUESTS", message },
    });
  };
}

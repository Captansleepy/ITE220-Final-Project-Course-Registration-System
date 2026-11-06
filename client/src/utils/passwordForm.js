// Small helpers for the Forgot Password and Reset Password pages.
// They are kept separate from the pages so they can be tested easily.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOKEN_PATTERN = /^[a-f0-9]{64}$/;

// Returns an error message, or "" when the email looks fine.
export function checkEmail(email) {
  const value = email.trim();
  if (!value) return "Email is required.";
  if (!EMAIL_PATTERN.test(value)) return "Enter a valid email address.";
  return "";
}

// Reads the reset token from the part of the link after "#".
// Example: "#token=abc..." gives "abc...". Returns "" if it is missing or malformed.
export function readResetToken(hash) {
  const params = new URLSearchParams((hash || "").replace(/^#/, ""));
  const token = params.get("token") || "";
  return TOKEN_PATTERN.test(token) ? token : "";
}

// Checks the two password boxes. Returns { password, confirm } error messages.
// The same 8–72 byte rule is checked again on the server.
export function checkNewPassword(password, confirm) {
  const errors = {};
  const bytes = new TextEncoder().encode(password).length;
  if (!password) errors.password = "Enter a new password.";
  else if (password.length < 8) errors.password = "Use at least 8 characters.";
  else if (bytes > 72) errors.password = "This password is too long. Use 72 bytes or fewer.";
  if (!confirm) errors.confirm = "Type the new password again.";
  else if (password && confirm !== password) errors.confirm = "The two passwords do not match.";
  return errors;
}

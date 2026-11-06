import { useState } from "react";
import { Link } from "react-router-dom";
import { requestPasswordReset } from "../api";
import AuthLayout from "../components/AuthLayout";
import { checkEmail } from "../utils/passwordForm";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [formError, setFormError] = useState("");
  const [sentMessage, setSentMessage] = useState(""); // shown after a successful request
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (loading) return;
    const problem = checkEmail(email);
    setEmailError(problem);
    setFormError("");
    if (problem) return;

    setLoading(true);
    try {
      const data = await requestPasswordReset(email.trim());
      setSentMessage(data?.message || "If an active account uses that email, we have sent a password reset link.");
    } catch (error) {
      setFormError(error.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // After sending: the same message for every email, so nobody learns which accounts exist.
  if (sentMessage) {
    return (
      <AuthLayout>
        <p className="eyebrow">Password help</p>
        <h1>Check your email.</h1>
        <p className="auth-notice" role="status">{sentMessage}</p>
        <p className="login-subtitle">Didn't get it? Check your spam folder, or wait a few minutes and try again.</p>
        <Link className="auth-back-link" to="/">← Back to sign in</Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <p className="eyebrow">Password help</p>
      <h1>Forgot your password?</h1>
      <p className="login-subtitle">Enter the email you use for Course Portal. We'll send you a link to choose a new password.</p>
      <form onSubmit={handleSubmit} noValidate>
        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Enter your email" autoComplete="email" autoFocus
            disabled={loading} aria-invalid={Boolean(emailError)}
            aria-describedby={emailError ? "email-error" : undefined} />
          {emailError && <p id="email-error" className="field-error">{emailError}</p>}
        </div>
        {formError && <p className="login-error" role="alert">{formError}</p>}
        <button type="submit" disabled={loading}>
          {loading ? "Sending link..." : "Send reset link"}
        </button>
      </form>
      <Link className="auth-back-link" to="/">← Back to sign in</Link>
    </AuthLayout>
  );
}

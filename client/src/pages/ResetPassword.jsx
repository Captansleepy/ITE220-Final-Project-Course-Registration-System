import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { resetPassword } from "../api";
import AuthLayout from "../components/AuthLayout";
import { checkNewPassword, readResetToken } from "../utils/passwordForm";


export default function ResetPassword() {
  const navigate = useNavigate();
  // Read the token from the link once, when the page opens.
  const [token] = useState(() => readResetToken(window.location.hash));
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [linkBroken, setLinkBroken] = useState(!token);
  const [loading, setLoading] = useState(false);

  // Then remove it from the address bar, so it is not left in the
  // browser history or visible on screen.
  useEffect(() => {
    if (window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    if (loading) return;
    const problems = checkNewPassword(password, confirm);
    setErrors(problems);
    setFormError("");
    if (Object.keys(problems).length > 0) return;

    setLoading(true);
    try {
      await resetPassword(token, password);
      // Any old login on this browser no longer works, so remove it.
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      navigate("/?reset=done", { replace: true });
    } catch (error) {
      if (error.code === "INVALID_RESET_LINK") setLinkBroken(true);
      else setFormError(error.message || "Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  if (linkBroken) {
    return (
      <AuthLayout>
        <p className="eyebrow">Password help</p>
        <h1>This link doesn't work.</h1>
        <p className="login-subtitle">Reset links work once and only for 30 minutes. Asking for a new link also cancels older ones.</p>
        <Link className="auth-button-link" to="/forgot-password">Request a new link</Link>
        <Link className="auth-back-link" to="/">← Back to sign in</Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <p className="eyebrow">Password help</p>
      <h1>Choose a new password.</h1>
      <p className="login-subtitle">Use at least 8 characters. You'll be signed out everywhere and can then sign in with the new password.</p>
      <form onSubmit={handleSubmit} noValidate>
        <div className="form-group">
          <label htmlFor="new-password">New password</label>
          <input id="new-password" type="password" value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password" autoFocus disabled={loading}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? "new-password-error" : undefined} />
          {errors.password && <p id="new-password-error" className="field-error">{errors.password}</p>}
        </div>
        <div className="form-group">
          <label htmlFor="confirm-password">Confirm new password</label>
          <input id="confirm-password" type="password" value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            autoComplete="new-password" disabled={loading}
            aria-invalid={Boolean(errors.confirm)}
            aria-describedby={errors.confirm ? "confirm-password-error" : undefined} />
          {errors.confirm && <p id="confirm-password-error" className="field-error">{errors.confirm}</p>}
        </div>
        {formError && <p className="login-error" role="alert">{formError}</p>}
        <button type="submit" disabled={loading}>
          {loading ? "Saving..." : "Save new password"}
        </button>
      </form>
      <Link className="auth-back-link" to="/">← Back to sign in</Link>
    </AuthLayout>
  );
}

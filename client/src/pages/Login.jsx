import { useState } from "react";
import "./Login.css";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [loginError, setLoginError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    const newErrors = {};

    if (!email.trim()) {
      newErrors.email = "Email is required.";
    }

    if (!password.trim()) {
      newErrors.password = "Password is required.";
    }

    setErrors(newErrors);
    setLoginError("");

    if (Object.keys(newErrors).length > 0) {
      return;
    }

    setLoading(true);

    // TODO: Connect this form to the authentication API when it is ready.
    // Do not treat sample or arbitrary credentials as a successful login.
    await Promise.resolve();

    setLoginError(
      "Login is not connected to the authentication API yet."
    );

    setLoading(false);
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <h1>Course Registration System</h1>
        <p className="login-subtitle">Sign in to continue</p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="email">Email</label>

            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Enter your email"
              autoComplete="email"
            />

            {errors.email && (
              <p className="field-error">{errors.email}</p>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>

            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
            />

            {errors.password && (
              <p className="field-error">{errors.password}</p>
            )}
          </div>

          {loginError && (
            <p className="login-error" role="alert">
              {loginError}
            </p>
          )}

          <button type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}
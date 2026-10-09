import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../api";
import "./Login.css";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [loginError, setLoginError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (loading) return;
    const newErrors = {};
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      newErrors.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      newErrors.email = "Enter a valid email address.";
    }
    if (!password) newErrors.password = "Password is required.";
    setErrors(newErrors);
    setLoginError("");
    if (Object.keys(newErrors).length > 0) return;

    setLoading(true);
    try {
      const data = await login(normalizedEmail, password);
      const role = data?.user?.role;
      const destination = role === "student" ? "/student"
        : role === "admin" ? "/admin"
        : role === "advisor" ? "/advisor" : null;
      if (!destination || typeof data?.token !== "string" || !data.token) {
        throw new Error("The server returned an invalid login response.");
      }
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      navigate(destination, { replace: true });
    } catch (error) {
      setLoginError(error.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <h1>Course Registration System</h1>
        <p className="login-subtitle">Sign in to continue</p>
        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Enter your email" autoComplete="email"
              disabled={loading} aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "email-error" : undefined} />
            {errors.email && <p id="email-error" className="field-error">{errors.email}</p>}
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password" autoComplete="current-password"
              disabled={loading} aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? "password-error" : undefined} />
            {errors.password && <p id="password-error" className="field-error">{errors.password}</p>}
          </div>
          {loginError && <p className="login-error" role="alert">{loginError}</p>}
          <button type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}
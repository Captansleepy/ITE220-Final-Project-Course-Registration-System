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
      <aside className="login-intro">
        <a className="portal-wordmark" href="/" aria-label="Course Portal home"><span className="portal-symbol" aria-hidden="true">C</span> Course Portal</a>
        <div className="login-intro-copy"><p className="eyebrow">Your academic workspace</p>
          <h2>A clearer view of<br />your next term.</h2>
          <p>Keep your courses, weekly schedule and academic progress in one place.</p>
          <div className="login-feature"><span>01</span><div><strong>Plan your week</strong><p>See when and where your classes meet.</p></div></div>
          <div className="login-feature"><span>02</span><div><strong>Stay on track</strong><p>Review registrations and earned credits.</p></div></div>
          <div className="login-feature"><span>03</span><div><strong>Find your next step</strong><p>Check course history and advisor details.</p></div></div>
        </div>
        <p className="login-intro-footer">Built for students. Connected with advisors.</p>
      </aside>
      <div className="login-form-area">
      <section className="login-card">
        <p className="eyebrow">Welcome to Course Portal</p>
        <h1>Welcome back.</h1>
        <p className="login-subtitle">Sign in to your academic workspace.</p>
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
            {loading ? "Signing in..." : "Sign in to your account"}
          </button>
        </form>
        <p className="login-support">Need access or help signing in?<br />Contact your portal administrator.</p>
      </section>
      <p className="login-footer">Course Portal · Student, advisor and administrator access</p>
      </div>
    </main>
  );
}

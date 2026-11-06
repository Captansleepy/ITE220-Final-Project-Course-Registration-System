import "../pages/Login.css";

// The shared two-column layout for Sign in, Forgot password and Reset password.
// Left: the navy introduction panel. Right: whatever page content is passed in.
export default function AuthLayout({ children }) {
  return (
    <main className="login-page">
      <aside className="login-intro">
        <a className="portal-wordmark" href="/" aria-label="Course Portal home"><span className="portal-symbol" aria-hidden="true">C</span> Course Portal</a>
        <div className="login-intro-copy"><p className="eyebrow">Your academic workspace</p>
          <h2>A clearer view of{" "}<br />your next term.</h2>
          <p>Keep your courses, weekly schedule and academic progress in one place.</p>
          <div className="login-feature"><span>01</span><div><strong>Plan your week</strong><p>See when and where your classes meet.</p></div></div>
          <div className="login-feature"><span>02</span><div><strong>Stay on track</strong><p>Review registrations and earned credits.</p></div></div>
          <div className="login-feature"><span>03</span><div><strong>Find your next step</strong><p>Check course history and advisor details.</p></div></div>
        </div>
        <p className="login-intro-footer">Built for students. Connected with advisors.</p>
      </aside>
      <div className="login-form-area">
        <section className="login-card">{children}</section>
        <p className="login-footer">Course Portal · Student, advisor and administrator access</p>
      </div>
    </main>
  );
}

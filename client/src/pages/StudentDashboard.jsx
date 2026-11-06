import AddDropRequests from "../components/AddDropRequests.jsx";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../api.js";
import WeeklyTimetable from "../components/WeeklyTimetable.jsx";
import "./StudentDashboard.css";

export default function StudentDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setError("");
      try {
        const result = await apiRequest("/student/dashboard", { signal: controller.signal });
        if (!controller.signal.aborted) setData(result);
      } catch (failure) {
        if (!controller.signal.aborted) setError(failure.message);
      }
    }
    load();
    return () => controller.abort();
  }, [attempt]);
  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/", { replace: true });
  }
  if (error) return <main className="student-dashboard">
    <h1>Student Dashboard</h1><p role="alert">{error}</p>
    <button type="button" onClick={() => setAttempt(value => value + 1)}>Retry</button>
    <button type="button" onClick={logout}>Return to login</button>
  </main>;
  if (!data) return <main className="student-dashboard"><p role="status">Loading your student records...</p></main>;

  const closingDate = value => value ? new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok",
  }).format(new Date(value)) + " (Bangkok time)" : "Not set - confirm with your advisor";
  const windowOpen = registration => registration.addDropOpen &&
    (!registration.addDropClosesAt || new Date(registration.addDropClosesAt).getTime() > now);
  return (
    <main className="student-dashboard">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Course Portal / Student workspace</p>
          <h1>Your academic overview</h1>
          <p>Welcome back, {data.student.name}.</p>
        </div>

        <div className="student-info-card">
          <span>Student ID</span>
          <strong>{data.student.studentId}</strong>
        </div>
        <button type="button" onClick={logout}>Logout</button>
      </header>

      <WeeklyTimetable registrations={data.registrations} />

      <section className="dashboard-section">
        <h2>Academic Summary</h2>

        <div className="summary-card">
          <span>Earned Credits</span>
          <strong>{data.earnedCredits}</strong>
        </div>
      </section>

      <section className="dashboard-section">
        <h2>Outstanding Failed Courses</h2>
        {data.outstandingFailures.length === 0 ? <p>No outstanding failed courses.</p> :
          <ul>{data.outstandingFailures.map(course => <li key={course.id}>{course.courseCode} — {course.courseName} <strong>(Retake required)</strong></li>)}</ul>}
      </section>
      <section className="dashboard-section">
        <h2>Current Registrations</h2>
        {data.registrations.length === 0 && <p>No active registrations in the current term.</p>}

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Course</th>
                <th>Section</th>
                <th>Meeting Times</th>
                <th>Instructor</th>
                <th>Add/Drop</th>
              </tr>
            </thead>

            <tbody>
              {data.registrations.map((registration) => (
                <tr key={registration.id}>
                  <td>
                    <strong>{registration.courseCode}</strong>
                    <div>{registration.courseName}</div>
                  </td>

                  <td>{registration.section}</td>

                  <td>
                    {registration.meetings.map((meeting, index) => (
                      <div
                        className="meeting-time"
                        key={`${meeting.day}-${meeting.time}-${index}`}
                      >
                        {meeting.day}, {meeting.time}, {meeting.room}
                      </div>
                    ))}
                  </td>
                  <td>{registration.instructor || "Not specified"}</td>
                  <td>
                    <strong>{windowOpen(registration) ? "Open" : "Closed"}</strong>
                    <div>Closing date: {closingDate(registration.addDropClosesAt)}</div>
                    {windowOpen(registration) && <a href="#student-requests">Request a change</a>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="dashboard-section">
        <h2>Academic History</h2>
        {data.history.length === 0 && <p>No academic records found.</p>}

        {data.history.map((term) => (
          <div className="history-group" key={term.term}>
            <h3>{term.term}</h3>

            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Course</th>
                    <th>Credits</th>
                    <th>Grade</th>
                  </tr>
                </thead>

                <tbody>
                  {term.courses.map((course) => (
                    <tr key={course.id}>
                      <td>
                        <strong>{course.courseCode}</strong>
                        <div>{course.courseName}</div>
                      </td>
                      <td>{course.credits}</td>
                      <td>{course.grade}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </section>

      <div id="student-requests"><AddDropRequests onChanged={() => setAttempt(value => value + 1)} /></div>
      <section className="dashboard-section">
        <h2>Advisor contact</h2>
        {data.advisor ? <p>{data.advisor.name} · <a href={`mailto:${data.advisor.email}`}>{data.advisor.email}</a></p> : <p>Contact your department to arrange an advisor.</p>}
        <p>Submit Add/Drop requests through the portal above. If your department asks for a signed form, you can also <a href="/forms/add-drop-request.pdf" download>download the PDF</a>.</p>
      </section>
    </main>
  );
}

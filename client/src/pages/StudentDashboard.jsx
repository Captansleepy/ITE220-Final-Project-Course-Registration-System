import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../api.js";
import "./StudentDashboard.css";

export default function StudentDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [requestId, setRequestId] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setData(null);
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

  const selected = data.registrations.find(r => r.id === requestId);
  const subject = selected ? `Add/Drop Request - ${data.student.studentId} - ${selected.courseCode}` : "";
  const closingDate = value => value ? new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok",
  }).format(new Date(value)) + " (Bangkok time)" : "Not set - confirm with your advisor";
  const windowOpen = registration => registration.addDropOpen &&
    (!registration.addDropClosesAt || new Date(registration.addDropClosesAt).getTime() > now);
  return (
    <main className="student-dashboard">
      <header className="dashboard-header">
        <div>
          <h1>Student Dashboard</h1>
          <p>Welcome, {data.student.name}</p>
        </div>

        <div className="student-info-card">
          <span>Student ID</span>
          <strong>{data.student.studentId}</strong>
        </div>
        <button type="button" onClick={logout}>Logout</button>
      </header>

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
          <ul>{data.outstandingFailures.map(course => <li key={course.id}>{course.courseCode} — {course.courseName}</li>)}</ul>}
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
                    {windowOpen(registration) && <button type="button" className="request-add-drop"
                      onClick={() => setRequestId(registration.id)}>Request add/drop</button>}
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

      <section className="dashboard-section add-drop-section">
        <h2>Add / Drop Requests</h2>

        <p>Your advisor processes registration changes after reviewing your signed request.</p>
        {data.advisor ? <p>Assigned advisor: <strong>{data.advisor.name}</strong><br />
          <a className="advisor-email" href={`mailto:${data.advisor.email}`}>{data.advisor.email}</a></p> :
          <p role="status">No active advisor contact is available. Contact your department before submitting a request.</p>}
        <a href="/forms/add-drop-request.pdf" download>Download Add/Drop Form (PDF)</a>
        {selected && windowOpen(selected) ? <div className="add-drop-request" aria-live="polite">
          <h3>Request for {selected.courseCode} - Section {selected.section}</h3>
          <p>Term: {selected.term}. Closing date: {closingDate(selected.addDropClosesAt)}</p>
          <ol>
            <li>Download and open the Add/Drop Request form.</li>
            <li>Fill in your student ID, name, term, and the course code and section you wish to add or drop.</li>
            <li>State the reason for the request and sign the form.</li>
            <li>Email the completed form as an attachment to your advisor at {data.advisor?.email || "the address provided by your department"}, using the subject line below.</li>
            <li>Your advisor will confirm by email once the change is made.</li>
          </ol>
          <p><strong>Email subject:</strong> <span className="request-subject">{subject}</span></p>
          {data.advisor && <a href={`mailto:${data.advisor.email}?subject=${encodeURIComponent(subject)}`}>Email advisor</a>}
          <p>The email link does not attach the form automatically. Attach your completed, signed PDF before sending.</p>
          <button type="button" onClick={() => setRequestId(null)}>Close instructions</button>
        </div> : <p>Select Request add/drop beside a registered course with an open window to see its email instructions.
          For a closed window, contact your advisor to ask about the available options.</p>}
      </section>
    </main>
  );
}
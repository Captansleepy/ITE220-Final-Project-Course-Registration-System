import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../api.js";
import "./StudentDashboard.css";

export default function StudentDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
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

        <p>
          Course add/drop requests are handled through the advisor workflow.
          Students should complete the official form and follow the provided
          instructions.
        </p>

        <p className="form-placeholder">
          Add/Drop form link will be provided by the team.
        </p>
      </section>
    </main>
  );
}
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import Navbar from "../components/Navbar";
import Loading from "../components/Loading";
import ErrorMessage from "../components/ErrorMessage";
import { getMyRegistrations, getMyRecord } from "../services/api";

function StudentDashboard() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [records, setRecords] = useState([]);
  const [gpa, setGpa] = useState(null);
  const [totalCredits, setTotalCredits] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadStudentData() {
      try {
        const savedUser = JSON.parse(
          localStorage.getItem("user") || "null"
        );

        setUser(savedUser);

        const [registrationData, recordData] = await Promise.all([
          getMyRegistrations(),
          getMyRecord(),
        ]);

        setRegistrations(
          registrationData.registrations || registrationData || []
        );

        setRecords(recordData.records || []);

        setGpa(recordData.gpa ?? null);

        setTotalCredits(recordData.totalCredits ?? 0);
      } catch (err) {
        setError(err.message || "Failed to load student data.");
      } finally {
        setLoading(false);
      }
    }

    loadStudentData();
  }, []);

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/");
  }

  if (loading) {
    return <Loading />;
  }

  return (
    <div className="student-dashboard">
      <Navbar user={user} onLogout={handleLogout} />

      <main className="dashboard-content">
        <h1>Student Dashboard</h1>

        <ErrorMessage message={error} />

        <section className="student-summary">
          <h2>Academic Summary</h2>

          <div className="summary-cards">
            <div className="summary-card">
              <h3>GPA</h3>
              <p>{gpa !== null ? gpa : "N/A"}</p>
            </div>

            <div className="summary-card">
              <h3>Total Credits Earned</h3>
              <p>{totalCredits}</p>
            </div>
          </div>
        </section>

        <section className="current-courses">
          <h2>Current Registration</h2>

          {registrations.length === 0 ? (
            <p>No courses registered for the current term.</p>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Course</th>
                    <th>Section</th>
                    <th>Day</th>
                    <th>Time</th>
                    <th>Room</th>
                    <th>Instructor</th>
                    <th>Add/Drop</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {registrations.map((registration) => {
                    const offering =
                      registration.offering || registration.offeringId || {};

                    const course = offering.course || offering.courseId || {};

                    return (
                      <tr key={registration._id}>
                        <td>
                          {course.code || "N/A"}{" "}
                          {course.title ? `- ${course.title}` : ""}
                        </td>

                        <td>{offering.section || "N/A"}</td>

                        <td>{offering.day || "N/A"}</td>

                        <td>
                          {offering.startTime && offering.endTime
                            ? `${offering.startTime} - ${offering.endTime}`
                            : "N/A"}
                        </td>

                        <td>{offering.room || "N/A"}</td>

                        <td>{offering.instructor || "N/A"}</td>

                        <td>
                          {offering.addDropOpen ? (
                            <span className="status-open">Open</span>
                          ) : (
                            <span className="status-closed">Closed</span>
                          )}
                        </td>

                        <td>
                          {offering.addDropOpen ? (
                            <a
                              className="request-button"
                              href="#add-drop"
                            >
                              Request Add/Drop
                            </a>
                          ) : (
                            "-"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="academic-record">
          <h2>Academic Record</h2>

          {records.length === 0 ? (
            <p>No completed courses found.</p>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Term</th>
                    <th>Course</th>
                    <th>Credits</th>
                    <th>Grade</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {records.map((record) => {
                    const course = record.course || record.courseId || {};
                    const failed = record.grade === "F";

                    return (
                      <tr key={record._id}>
                        <td>{record.term}</td>

                        <td>
                          {course.code || "N/A"}{" "}
                          {course.title ? `- ${course.title}` : ""}
                        </td>

                        <td>{course.credits ?? "N/A"}</td>

                        <td>{record.grade}</td>

                        <td>
                          {failed ? (
                            <strong className="retake-required">
                              Retake required
                            </strong>
                          ) : (
                            "Completed"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section id="add-drop" className="add-drop-section">
          <h2>Add / Drop Request</h2>

          <p>
            If Add/Drop is open for your course, follow the instructions
            below.
          </p>

          <ol>
            <li>Download and open the Add/Drop Request form.</li>

            <li>
              Fill in your student ID, name, term, course code and section
              you wish to add or drop.
            </li>

            <li>
              State the reason for the request and sign the form.
            </li>

            <li>
              Email the completed form as an attachment to your advisor
              using the required subject line.
            </li>

            <li>
              Your advisor will confirm by email once the change is made.
            </li>
          </ol>

          <a
            className="download-button"
            href="/add-drop-form.pdf"
            download
          >
            Download Add/Drop Form
          </a>
        </section>
      </main>
    </div>
  );
}

export default StudentDashboard;
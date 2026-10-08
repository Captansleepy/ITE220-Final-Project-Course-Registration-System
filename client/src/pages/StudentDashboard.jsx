import "./StudentDashboard.css";

const sampleStudent = {
  name: "Sample Student",
  studentId: "STU-2026-001",
  earnedCredits: 54,
};

const sampleRegistrations = [
  {
    courseCode: "ITE220",
    courseName: "Web Development II",
    section: "1",
    meetings: [
      {
        day: "Monday",
        time: "09:00 - 10:30",
        room: "A201",
      },
      {
        day: "Wednesday",
        time: "09:00 - 10:30",
        room: "A201",
      },
    ],
  },
  {
    courseCode: "ITE254",
    courseName: "Human Computer Interaction",
    section: "2",
    meetings: [
      {
        day: "Tuesday",
        time: "13:00 - 16:00",
        room: "B305",
      },
    ],
  },
];

const sampleHistory = [
  {
    term: "Term 1, 2026",
    courses: [
      {
        courseCode: "ITE210",
        courseName: "Database Systems",
        credits: 3,
        grade: "B+",
      },
      {
        courseCode: "ITE230",
        courseName: "Computer Networks",
        credits: 3,
        grade: "A",
      },
    ],
  },
  {
    term: "Term 3, 2025",
    courses: [
      {
        courseCode: "ITE201",
        courseName: "Object-Oriented Programming",
        credits: 3,
        grade: "B",
      },
    ],
  },
];

export default function StudentDashboard() {
  return (
    <main className="student-dashboard">
      <header className="dashboard-header">
        <div>
          <p className="sample-label">Sample data</p>
          <h1>Student Dashboard</h1>
          <p>Welcome, {sampleStudent.name}</p>
        </div>

        <div className="student-info-card">
          <span>Student ID</span>
          <strong>{sampleStudent.studentId}</strong>
        </div>
      </header>

      <section className="dashboard-section">
        <h2>Academic Summary</h2>

        <div className="summary-card">
          <span>Earned Credits</span>
          <strong>{sampleStudent.earnedCredits}</strong>
        </div>
      </section>

      <section className="dashboard-section">
        <h2>Current Registrations</h2>

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
              {sampleRegistrations.map((registration) => (
                <tr key={`${registration.courseCode}-${registration.section}`}>
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

        {sampleHistory.map((term) => (
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
                    <tr key={course.courseCode}>
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

        <a href="/add-drop-form.pdf">
          Open Add/Drop Form
        </a>
      </section>
    </main>
  );
}
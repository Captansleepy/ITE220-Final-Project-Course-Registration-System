import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { apiRequest } from "./api";
import Login from "./pages/Login";
import AdminDashboard from "./pages/AdminDashboard";
import ProtectedRoute from "./components/ProtectedRoute";

function StudentDashboard() {
  return (
    <main>
      <h1>Student Dashboard</h1>
      <p>Welcome to the Student Dashboard.</p>
    </main>
  );
}

function AdvisorDashboard() {
  const [selectedStudent, setSelectedStudent] = useState(null);

  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const students = [
    {
      id: "STU001",
      name: "Student 001",
      email: "student001@example.test",
      program: "Information Technology",
      status: "Active",
    },
    {
      id: "STU002",
      name: "Student 002",
      email: "student002@example.test",
      program: "Information Technology",
      status: "Active",
    },
    {
      id: "STU003",
      name: "Student 003",
      email: "student003@example.test",
      program: "Information Technology",
      status: "Active",
    },
    {
      id: "STU004",
      name: "Student 004",
      email: "student004@example.test",
      program: "Information Technology",
      status: "Active",
    },
    {
      id: "STU005",
      name: "Student 005",
      email: "student005@example.test",
      program: "Information Technology",
      status: "Active",
    },
  ];

  const history = selectedStudent
    ? [
        {
          course: "CSC220",
          title: "Web Development II",
          term: "Term 1-2026",
          grade: "A",
          status: "Completed",
        },
        {
          course: "ITE254",
          title: "Database Systems",
          term: "Term 1-2026",
          grade: "B+",
          status: "Completed",
        },
        {
          course: "ITE321",
          title: "Data Communication",
          term: "Term 2-2026",
          grade: "-",
          status: "Registered",
        },
      ]
    : [];

  return (
    <main className="admin-main">
      <header className="admin-header">
        <div>
          <h1>Advisor Dashboard</h1>
          <p>Manage students and view student academic history.</p>
        </div>

        <div className="admin-user">
          <strong>{user.name || "Advisor"}</strong>
          <span>{user.email || "advisor@example.test"}</span>
        </div>
      </header>

      <section className="dashboard-panel">
        <h2>My Students</h2>

        <div className="student-table-wrapper">
          <table className="student-table">
            <thead>
              <tr>
                <th>Student ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Program</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {students.map((student) => (
                <tr key={student.id}>
                  <td>{student.id}</td>
                  <td>{student.name}</td>
                  <td>{student.email}</td>
                  <td>{student.program}</td>
                  <td>{student.status}</td>
                  <td>
                    <button
                      type="button"
                      onClick={() => setSelectedStudent(student)}
                    >
                      View History
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="dashboard-panel">
        <h2>Student History</h2>

        {!selectedStudent ? (
          <div className="empty-state">
            <p>No student selected.</p>
            <span>Select a student above to view academic history.</span>
          </div>
        ) : (
          <>
            <p>
              <strong>{selectedStudent.name}</strong> (
              {selectedStudent.id})
            </p>

            <div className="student-table-wrapper">
              <table className="student-table">
                <thead>
                  <tr>
                    <th>Course</th>
                    <th>Course Name</th>
                    <th>Term</th>
                    <th>Grade</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {history.map((record) => (
                    <tr key={record.course}>
                      <td>{record.course}</td>
                      <td>{record.title}</td>
                      <td>{record.term}</td>
                      <td>{record.grade}</td>
                      <td>{record.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function App() {
  const [connection, setConnection] = useState({
    loading: true,
    message: "",
    error: "",
  });

  useEffect(() => {
    const controller = new AbortController();

    async function checkConnection() {
      try {
        const data = await apiRequest("/health", {
          signal: controller.signal,
        });

        if (data?.status !== "ok") {
          throw new Error("The API returned an unexpected response.");
        }

        setConnection({
          loading: false,
          message: `Connected to ${data.service}`,
          error: "",
        });
      } catch (error) {
        if (controller.signal.aborted) return;

        setConnection({
          loading: false,
          message: "",
          error: error.message,
        });
      }
    }

    checkConnection();

    return () => controller.abort();
  }, []);

  return (
    <>
      {connection.loading && (
        <p role="status">Checking API connection...</p>
      )}

      {connection.message && (
        <p role="status">{connection.message}</p>
      )}

      {connection.error && (
        <p role="alert">
          Could not connect to the API: {connection.error}
        </p>
      )}

      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />

          <Route
            path="/student"
            element={
              <ProtectedRoute allowedRole="student">
                <StudentDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRole="admin">
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/advisor"
            element={
              <ProtectedRoute allowedRole="advisor">
                <AdvisorDashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
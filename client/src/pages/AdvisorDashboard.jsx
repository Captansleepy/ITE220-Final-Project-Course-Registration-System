import { useEffect, useState } from "react";
import { apiRequest } from "../api.js";

export default function AdvisorDashboard() {
  const [students, setStudents] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [studentsError, setStudentsError] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [result, setResult] = useState({ studentId: null, history: [], loading: false, error: "" });
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const data = await apiRequest("/advisor/students", { signal: controller.signal });
        if (!controller.signal.aborted) setStudents(data.students);
      } catch (error) {
        if (!controller.signal.aborted) setStudentsError(error.message);
      } finally {
        if (!controller.signal.aborted) setStudentsLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!selectedStudent) return;
    const controller = new AbortController();
    const studentId = selectedStudent.id;
    async function load() {
      setResult({ studentId, history: [], loading: true, error: "" });
      try {
        const data = await apiRequest(`/advisor/students/${encodeURIComponent(studentId)}/history`, { signal: controller.signal });
        if (!controller.signal.aborted) {
          setResult({ studentId, history: data.history, loading: false, error: "" });
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setResult({ studentId, history: [], loading: false, error: error.message });
        }
      }
    }
    load();
    return () => controller.abort();
  }, [selectedStudent]);

function handleLogout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "/";
}

  const historyLoading = result.loading || result.studentId !== selectedStudent?.id;
  return (
    <main className="admin-main">
      <header className="admin-header">
        <div><h1>Advisor Dashboard</h1><p>Manage students and view student academic history.</p></div>
        <div className="admin-user">
  <strong>{user.name}</strong>
  <span>{user.email}</span>
  <button
    type="button"
    className="logout-button"
    onClick={handleLogout}
  >
    Logout
  </button>
</div>
      </header>
      <section className="dashboard-panel">
        <h2>My Students</h2>
        {studentsLoading ? <p role="status">Loading assigned students...</p> :
          studentsError ? <p role="alert">{studentsError}</p> :
          students.length === 0 ? <p>No students are assigned to you.</p> : (
            <div className="student-table-wrapper"><table className="student-table">
              <thead><tr><th>Student ID</th><th>Name</th><th>Email</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>{students.map((student) => <tr key={student.id}>
                <td>{student.studentId}</td><td>{student.name}</td><td>{student.email}</td>
                <td>{student.active ? "Active" : "Inactive"}</td>
                <td><button type="button" onClick={() => setSelectedStudent(student)}>View History</button></td>
              </tr>)}</tbody>
            </table></div>
          )}
      </section>
      <section className="dashboard-panel">
        <h2>Student History</h2>
        {!selectedStudent ? <p>Select a student above to view academic history.</p> : <>
          <p><strong>{selectedStudent.name}</strong> ({selectedStudent.studentId})</p>
          <p>Recorded grades from previous study. Current registrations are separate.</p>
          {historyLoading ? <p role="status">Loading history...</p> :
            result.error ? <p role="alert">{result.error}</p> :
            result.history.length === 0 ? <p>No academic records found for this student.</p> : (
              <div className="student-table-wrapper"><table className="student-table">
                <thead><tr><th>Course</th><th>Course Name</th><th>Credits</th><th>Term</th><th>Grade</th></tr></thead>
                <tbody>{result.history.map((record) => <tr key={record.id}>
                  <td>{record.courseCode}</td><td>{record.courseTitle}</td><td>{record.credits ?? "—"}</td><td>{record.term}</td><td>{record.grade}</td>
                </tr>)}</tbody>
              </table></div>
            )}
        </>}
      </section>
    </main>
  );
}

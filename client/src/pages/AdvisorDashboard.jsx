
import { useEffect, useState } from "react";
import { apiRequest } from "../api.js";

const emptyRegistrationData = {
  registrations: [],
  offerings: [],
  loading: false,
  error: "",
};

function formatSchedule(meetings) {
  if (!Array.isArray(meetings) || meetings.length === 0) {
    return "No schedule listed";
  }

  return meetings
    .map(
      (meeting) =>
        `${meeting.day} ${meeting.startTime}-${meeting.endTime}`
    )
    .join(", ");
}

async function fetchRegistrationData(studentId) {
  const id = encodeURIComponent(studentId);

  const [registrationResponse, offeringResponse] = await Promise.all([
    apiRequest(`/advisor/students/${id}/registrations`),
    apiRequest(`/advisor/students/${id}/offerings`),
  ]);

  return {
    registrations: registrationResponse.registrations || [],
    offerings: offeringResponse.offerings || [],
    loading: false,
    error: "",
  };
}

export default function AdvisorDashboard() {
  const [students, setStudents] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [studentsError, setStudentsError] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);

  const [result, setResult] = useState({
    studentId: null,
    history: [],
    loading: false,
    error: "",
  });

  const [registrationData, setRegistrationData] = useState(
    emptyRegistrationData
  );
  const [pendingAction, setPendingAction] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");

  const user = JSON.parse(localStorage.getItem("user") || "{}");

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const data = await apiRequest("/advisor/students", {
          signal: controller.signal,
        });

        if (!controller.signal.aborted) {
          setStudents(data.students || []);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setStudentsError(error.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setStudentsLoading(false);
        }
      }
    }

    load();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!selectedStudent) {
      setResult({
        studentId: null,
        history: [],
        loading: false,
        error: "",
      });
      return;
    }

    const controller = new AbortController();
    const studentId = selectedStudent.id;

    setResult({
      studentId,
      history: [],
      loading: true,
      error: "",
    });

    async function load() {
      try {
        const data = await apiRequest(
          `/advisor/students/${encodeURIComponent(studentId)}/history`,
          { signal: controller.signal }
        );

        if (!controller.signal.aborted) {
          setResult({
            studentId,
            history: data.history || [],
            loading: false,
            error: "",
          });
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setResult({
            studentId,
            history: [],
            loading: false,
            error: error.message,
          });
        }
      }
    }

    load();
    return () => controller.abort();
  }, [selectedStudent]);

  useEffect(() => {
    if (!selectedStudent) {
      setRegistrationData(emptyRegistrationData);
      return;
    }

    let cancelled = false;

    setRegistrationData({
      ...emptyRegistrationData,
      loading: true,
    });
    setActionMessage("");
    setActionError("");

    fetchRegistrationData(selectedStudent.id)
      .then((data) => {
        if (!cancelled) setRegistrationData(data);
      })
      .catch((error) => {
        if (!cancelled) {
          setRegistrationData({
            ...emptyRegistrationData,
            error: error.message,
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedStudent]);

  async function refreshRegistrationData(studentId) {
    const data = await fetchRegistrationData(studentId);
    setRegistrationData(data);
  }

  async function handleRegister(offeringId) {
    if (!selectedStudent || pendingAction) return;

    const studentId = selectedStudent.id;
    setPendingAction(offeringId);
    setActionMessage("");
    setActionError("");

    try {
      await apiRequest(
        `/advisor/students/${encodeURIComponent(studentId)}/registrations`,
        {
          method: "POST",
          body: JSON.stringify({ offeringId }),
        }
      );

      setActionMessage("Registration completed successfully.");
      await refreshRegistrationData(studentId);
    } catch (error) {
      setActionError(error.message);

      try {
        await refreshRegistrationData(studentId);
      } catch {
        // Preserve existing data if refreshing fails.
      }
    } finally {
      setPendingAction("");
    }
  }

  async function handleDrop(registrationId) {
    if (!selectedStudent || pendingAction) return;

    const studentId = selectedStudent.id;
    setPendingAction(registrationId);
    setActionMessage("");
    setActionError("");

    try {
      await apiRequest(
        `/advisor/students/${encodeURIComponent(studentId)}/registrations/${encodeURIComponent(registrationId)}`,
        { method: "DELETE" }
      );

      setActionMessage("Registration dropped successfully.");
      await refreshRegistrationData(studentId);
    } catch (error) {
      setActionError(error.message);

      try {
        await refreshRegistrationData(studentId);
      } catch {
        // Preserve existing data if refreshing fails.
      }
    } finally {
      setPendingAction("");
    }
  }

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/";
  }

  const historyLoading =
    result.loading || result.studentId !== selectedStudent?.id;

  return (
    <main className="admin-main">
      <header className="admin-header">
        <div>
          <h1>Advisor Dashboard</h1>
          <p>Manage students, academic history, and course registrations.</p>
        </div>

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

        {studentsLoading ? (
          <p role="status">Loading assigned students...</p>
        ) : studentsError ? (
          <p role="alert">{studentsError}</p>
        ) : students.length === 0 ? (
          <p>No students are assigned to you.</p>
        ) : (
          <div className="student-table-wrapper">
            <table className="student-table">
              <thead>
                <tr>
                  <th>Student ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id}>
                    <td>{student.studentId}</td>
                    <td>{student.name}</td>
                    <td>{student.email}</td>
                    <td>{student.active ? "Active" : "Inactive"}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => setSelectedStudent(student)}
                        disabled={Boolean(pendingAction)}
                      >
                        {selectedStudent?.id === student.id
                          ? "Selected"
                          : "View Student"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="dashboard-panel">
        <h2>Student History</h2>

        {!selectedStudent ? (
          <p>Select a student above to view academic history.</p>
        ) : (
          <>
            <p>
              <strong>{selectedStudent.name}</strong> (
              {selectedStudent.studentId})
            </p>
            <p>Recorded grades from previous study.</p>

            {historyLoading ? (
              <p role="status">Loading history...</p>
            ) : result.error ? (
              <p role="alert">{result.error}</p>
            ) : result.history.length === 0 ? (
              <p>No academic records found for this student.</p>
            ) : (
              <div className="student-table-wrapper">
                <table className="student-table">
                  <thead>
                    <tr>
                      <th>Course</th>
                      <th>Course Name</th>
                      <th>Credits</th>
                      <th>Term</th>
                      <th>Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.history.map((record) => (
                      <tr key={record.id}>
                        <td>{record.courseCode}</td>
                        <td>{record.courseTitle}</td>
                        <td>{record.credits ?? "—"}</td>
                        <td>{record.term}</td>
                        <td>{record.grade}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>

      <section className="dashboard-panel">
        <h2>Current Registrations</h2>

        {!selectedStudent ? (
          <p>Select a student to view current registrations.</p>
        ) : registrationData.loading ? (
          <p role="status">Loading registrations...</p>
        ) : registrationData.error ? (
          <p role="alert">{registrationData.error}</p>
        ) : registrationData.registrations.length === 0 ? (
          <p>No current registrations found.</p>
        ) : (
          <div className="student-table-wrapper">
            <table className="student-table">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Course Name</th>
                  <th>Credits</th>
                  <th>Term</th>
                  <th>Section</th>
                  <th>Schedule</th>
                  <th>Room</th>
                  <th>Instructor</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {registrationData.registrations.map((registration) => {
                  const offering = registration.offering || {};

                  return (
                    <tr key={registration.id}>
                      <td>{offering.courseCode || "—"}</td>
                      <td>{offering.courseTitle || "—"}</td>
                      <td>{offering.credits ?? "—"}</td>
                      <td>{offering.term || "—"}</td>
                      <td>{offering.section || "—"}</td>
                      <td>{formatSchedule(offering.meetings)}</td>
                      <td>{offering.room || "—"}</td>
                      <td>{offering.instructor || "—"}</td>
                      <td>
                        <button
                          type="button"
                          onClick={() => handleDrop(registration.id)}
                          disabled={Boolean(pendingAction)}
                        >
                          {pendingAction === registration.id
                            ? "Dropping..."
                            : "Drop"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="dashboard-panel">
        <h2>Available Offerings</h2>

        {!selectedStudent ? (
          <p>Select a student to view available offerings.</p>
        ) : (
          <>
            <p>
              Current-term offerings for <strong>{selectedStudent.name}</strong>.
            </p>

            {actionMessage && <p role="status">{actionMessage}</p>}
            {actionError && <p role="alert">{actionError}</p>}

            {registrationData.loading ? (
              <p role="status">Loading available offerings...</p>
            ) : registrationData.error ? (
              <p role="alert">{registrationData.error}</p>
            ) : registrationData.offerings.length === 0 ? (
              <p>No current offerings found.</p>
            ) : (
              <div className="student-table-wrapper">
                <table className="student-table">
                  <thead>
                    <tr>
                      <th>Course</th>
                      <th>Course Name</th>
                      <th>Credits</th>
                      <th>Term</th>
                      <th>Section</th>
                      <th>Schedule</th>
                      <th>Room</th>
                      <th>Instructor</th>
                      <th>Seats Left</th>
                      <th>Eligibility</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registrationData.offerings.map((offering) => (
                      <tr key={offering.id}>
                        <td>{offering.courseCode}</td>
                        <td>
                          {offering.courseTitle}
                          {offering.retakeRequired && (
                            <strong> (Retake required)</strong>
                          )}
                        </td>
                        <td>{offering.credits}</td>
                        <td>{offering.term}</td>
                        <td>{offering.section}</td>
                        <td>{formatSchedule(offering.meetings)}</td>
                        <td>{offering.room || "—"}</td>
                        <td>{offering.instructor || "—"}</td>
                        <td>
                          {offering.seatsRemaining ?? "—"} /{" "}
                          {offering.capacity ?? "—"}
                        </td>
                        <td>
                          {offering.eligible
                            ? "Eligible"
                            : offering.reason || "Registration unavailable"}
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() => handleRegister(offering.id)}
                            disabled={
                              !offering.eligible ||
                              Boolean(pendingAction) ||
                              !selectedStudent.active
                            }
                          >
                            {pendingAction === offering.id
                              ? "Registering..."
                              : "Register"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}

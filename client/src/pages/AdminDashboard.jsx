import { useEffect, useState } from "react";
import { apiRequest } from "../api.js";
import AccountManagement from "../components/AccountManagement.jsx";

function AdminDashboard() {
  const [activeMenu, setActiveMenu] = useState("Dashboard");

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
const [createLoading, setCreateLoading] = useState(false);
const [createError, setCreateError] = useState("");
const [createSuccess, setCreateSuccess] = useState("");
const [editingStudent, setEditingStudent] = useState(null);
const [editLoading, setEditLoading] = useState(false);
const [editError, setEditError] = useState("");
const [editSuccess, setEditSuccess] = useState("");

const [formData, setFormData] = useState({
  name: "",
  email: "",
  password: "",
  studentId: "",
  advisor: "",
});

  const [courses, setCourses] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [coursesError, setCoursesError] = useState("");

const [sections, setSections] = useState([]);
const [sectionsLoading, setSectionsLoading] = useState(true);
const [sectionsError, setSectionsError] = useState("");



 useEffect(() => {
    async function loadUsers() {
      try {
        const result = await apiRequest("/admin/users");
        setUsers(result.users || []);
      } catch (err) {
        setError(err.message || "Failed to load users.");
      } finally {
        setLoading(false);
      }
    }

    loadUsers();
  }, []);

  useEffect(() => {
    async function loadCourses() {
      try {
        const result = await apiRequest("/admin/courses");
        setCourses(result.courses || []);
      } catch (err) {
        setCoursesError(err.message || "Failed to load courses.");
      } finally {
        setCoursesLoading(false);
      }
    }

    loadCourses();
  }, []);


useEffect(() => {
  async function loadSections() {
    try {
      const result = await apiRequest("/admin/sections");
      setSections(result.sections || []);
    } catch (err) {
      setSectionsError(err.message || "Failed to load sections.");
    } finally {
      setSectionsLoading(false);
    }
  }

  loadSections();
}, []);


async function reloadUsers() {
  setLoading(true);
  setError("");

  try {
    const result = await apiRequest("/admin/users");
    setUsers(result.users || []);
  } catch (err) {
    setError(err.message || "Failed to load users.");
  } finally {
    setLoading(false);
  }
}



async function handleCreateStudent(event) {
  event.preventDefault();
  setCreateLoading(true);
  setCreateError("");
  setCreateSuccess("");

  try {
    await apiRequest("/admin/users", {
      method: "POST",
      body: JSON.stringify({
        ...formData,
        role: "student",
      }),
    });

    setCreateSuccess("Student created successfully.");
    setFormData({
      name: "",
      email: "",
      password: "",
      studentId: "",
      advisor: "",
    });
    setShowCreateForm(false);
    await reloadUsers();
  } catch (err) {
    setCreateError(err.message || "Failed to create student.");
  } finally {
    setCreateLoading(false);
  }
}

async function handleEditStudent(event) {
  event.preventDefault();
  if (!editingStudent) return;

  setEditLoading(true);
  setEditError("");
  setEditSuccess("");

  try {
    await apiRequest(`/admin/users/${editingStudent.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: editingStudent.name,
      }),
    });

    setEditSuccess("Student updated successfully.");
    setEditingStudent(null);
    await reloadUsers();
  } catch (err) {
    setEditError(err.message || "Failed to update student.");
  } finally {
    setEditLoading(false);
  }
}

async function handleDeactivateStudent(student) {
  const confirmed = window.confirm(
    `Deactivate ${student.name} (${student.studentId})?`
  );

  if (!confirmed) return;

  setEditError("");
  setEditSuccess("");

  try {
    await apiRequest(`/admin/users/${student.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        active: false,
      }),
    });

    setEditSuccess("Student deactivated successfully.");
    await reloadUsers();
  } catch (err) {
    setEditError(err.message || "Failed to deactivate student.");
  }
}

const user = JSON.parse(localStorage.getItem("user") || "{}");

const students = users.filter(
  (item) => item.role === "student"
);

const advisors = users.filter(
  (item) => item.role === "advisor"
);


const registrations = [];

const menuItems = [
"Dashboard",
"Accounts",
"Students",
"Advisors",
"Courses",
"Sections",
];

function handleLogout() {
localStorage.removeItem("token");
localStorage.removeItem("user");
window.location.href = "/";
}

return ( <div className="admin-layout"> <aside className="admin-sidebar"> <div className="admin-brand"> <h2>Course Registration</h2> <p>Admin Panel</p> </div>


<nav>
  {menuItems.map((item) => (
    <button
      key={item}
      type="button"
      className={`sidebar-item ${
        activeMenu === item ? "active" : ""
      }`}
      onClick={() => setActiveMenu(item)}
    >
      {item}
    </button>
  ))}
</nav>

    <button className="logout-button" onClick={handleLogout}>
      Logout
    </button>
  </aside>

  <main className="admin-main">
    <header className="admin-header">
      <div>
        <h1>{activeMenu}</h1>
        <p>Course Registration System</p>
      </div>

      <div className="admin-user">
        <strong>{user.name || "Administrator"}</strong>
        <span>{user.email || "admin@example.test"}</span>
      </div>
    </header>


{activeMenu === "Accounts" && <AccountManagement />}

{activeMenu === "Dashboard" && (
  <section className="dashboard-panel">
    <h2>Dashboard Overview</h2>

    <div className="dashboard-stats">
      <div className="dashboard-panel">
        <h3>Total Students</h3>
        <p>{loading ? "Loading..." : students.length}</p>
      </div>

      <div className="dashboard-panel">
        <h3>Total Advisors</h3>
        <p>{loading ? "Loading..." : advisors.length}</p>
      </div>

      <div className="dashboard-panel">
        <h3>Total Courses</h3>
        <p>{coursesLoading ? "Loading..." : courses.length}</p>
      </div>

      <div className="dashboard-panel">
        <h3>Total Sections</h3>
<p>{sectionsLoading ? "Loading..." : sections.length}</p>
      </div>
    </div>
  </section>
)}

{activeMenu === "Courses" && (
  <section className="dashboard-panel">
    <h2>Courses</h2>

    <div className="student-table-wrapper">
      <table className="student-table">
        <thead>
          <tr>
            <th>Course Code</th>
            <th>Course Title</th>
            <th>Credits</th>
            <th>Status</th>
          </tr>
        </thead>

        <tbody>
          {coursesLoading && (
            <tr>
              <td colSpan="4">Loading courses...</td>
            </tr>
          )}

          {!coursesLoading && coursesError && (
            <tr>
              <td colSpan="4">Unable to load courses: {coursesError}</td>
            </tr>
          )}

          {!coursesLoading && !coursesError &&
            courses.map((course) => (
              <tr key={course.id}>
                <td>{course.code}</td>
                <td>{course.title}</td>
                <td>{course.credits}</td>
                <td>Available</td>
              </tr>
            ))}

          {!coursesLoading && !coursesError &&
            courses.length === 0 && (
              <tr>
                <td colSpan="4">No courses found.</td>
              </tr>
            )}
        </tbody>
      </table>
    </div>
  </section>
)}

    {activeMenu === "Students" && (
      <section className="dashboard-panel">
        <h2>Students</h2>

        {editError && <p role="alert">{editError}</p>}
{editSuccess && <p role="status">{editSuccess}</p>}

{editingStudent && (
  <form onSubmit={handleEditStudent}>
    <label>
      Student Name
      <input
        required
        maxLength={100}
        value={editingStudent.name}
        onChange={(event) =>
          setEditingStudent({
            ...editingStudent,
            name: event.target.value,
          })
        }
      />
    </label>

    <button
  type="button"
  disabled={editLoading}
  onClick={() => setEditingStudent(null)}
>
  Cancel
</button>
<button type="submit" disabled={editLoading}>
  {editLoading ? "Saving..." : "Save Changes"}
</button>
  </form>
)}


<button
  type="button"

onClick={() => {
  setEditingStudent(null);
  setCreateError("");
  setCreateSuccess("");
  setShowCreateForm(true);
}}
>
  Create Student
</button>

{createError && <p role="alert">{createError}</p>}
{createSuccess && <p role="status">{createSuccess}</p>}

{showCreateForm && (
  <form onSubmit={handleCreateStudent}>
    <div>
      <label>
        Name
        <input
          required
          maxLength={100}
          value={formData.name}
          onChange={(e) =>
            setFormData({ ...formData, name: e.target.value })
          }
        />
      </label>
    </div>

    <div>
      <label>
        Email
        <input
          required
          type="email"
          value={formData.email}
          onChange={(e) =>
            setFormData({ ...formData, email: e.target.value })
          }
        />
      </label>
    </div>

    <div>
      <label>
        Student ID
        <input
          required
          value={formData.studentId}
          onChange={(e) =>
            setFormData({ ...formData, studentId: e.target.value })
          }
        />
      </label>
    </div>

    <div>
      <label>
        Password
        <input
          required
          type="password"
          minLength={8}
          value={formData.password}
          onChange={(e) =>
            setFormData({ ...formData, password: e.target.value })
          }
        />
      </label>
    </div>

    <div>
      <label>
        Advisor
        <select
          required
          value={formData.advisor}
          onChange={(e) =>
            setFormData({ ...formData, advisor: e.target.value })
          }
        >
          <option value="">Select an advisor</option>
          {advisors
            .filter((advisor) => advisor.active)
            .map((advisor) => (
              <option key={advisor.id} value={advisor.id}>
                {advisor.name} ({advisor.email})
              </option>
            ))}

        </select>
      </label>
    </div>


<div className="form-actions">
  <button
    type="button"
    onClick={() => {
      setShowCreateForm(false);
      setCreateError("");
      setCreateSuccess("");
      setFormData({
        name: "",
        email: "",
        password: "",
        studentId: "",
        advisor: "",
      });
    }}
    disabled={createLoading}
  >
    Cancel
  </button>

  <button type="submit" disabled={createLoading}>
    {createLoading ? "Creating..." : "Save Student"}
  </button>
</div>


</form>
)}



        <div className="student-table-wrapper">
          <table className="student-table">
            <thead>
              <tr>
                <th>Student ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Advisor</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
  {loading && (
    <tr>
      <td colSpan="5">Loading students...</td>
    </tr>
  )}

  {!loading && error && (
    <tr>
      <td colSpan="5">Unable to load users: {error}</td>
    </tr>
  )}

  {!loading && !error && students.map((student) => (
    <tr key={student.id}>
      <td>{student.studentId || "-"}</td>
      <td>{student.name}</td>
      <td>{student.email}</td>
      <td>{student.advisor?.name || "Not assigned"}</td>

<td>{student.active ? "Active" : "Inactive"}</td>
<td>
  <button
    type="button"

onClick={() => {
  setShowCreateForm(false);
  setCreateError("");
  setCreateSuccess("");
  setEditError("");
  setEditSuccess("");
  setEditingStudent({
    id: student.id,
    name: student.name,
    studentId: student.studentId,
  });
}}
  >
    Edit
  </button>

  {student.active && student.id !== user.id && (
    <button
      type="button"
      onClick={() => handleDeactivateStudent(student)}
    >
      Deactivate
    </button>
  )}
</td>
    </tr>
  ))}

  {!loading && !error && students.length === 0 && (
    <tr>
      <td colSpan="5">No students found.</td>
    </tr>
  )}
</tbody>
          </table>
        </div>
      </section>
    )}

    {activeMenu === "Advisors" && (
  <section className="dashboard-panel">
    <h2>Advisors</h2>

    <div className="student-table-wrapper">
      <table className="student-table">
        <thead>
          <tr>
            <th>Advisor ID</th>
            <th>Name</th>
            <th>Email</th>
            <th>Students</th>
            <th>Status</th>
          </tr>
        </thead>

        <tbody>
  {advisors.map((advisor) => (
    <tr key={advisor.id}>
      <td>{advisor.id}</td>
      <td>{advisor.name}</td>
      <td>{advisor.email}</td>
      <td>
        {
          students.filter(
            (student) => student.advisor?.id === advisor.id
          ).length
        }
      </td>
      <td>{advisor.active ? "Active" : "Inactive"}</td>
    </tr>
  ))}
</tbody>
      </table>
    </div>
  </section>
)}


{activeMenu === "Sections" && (
  <section className="dashboard-panel">
    <h2>Sections</h2>

    <div className="student-table-wrapper">
      <table className="student-table">
        <thead>
          <tr>
            <th>Course</th>
            <th>Section</th>
            <th>Room</th>
            <th>Instructor</th>
          </tr>
        </thead>


<tbody>
  {sectionsLoading && (
    <tr>
      <td colSpan="4">Loading sections...</td>
    </tr>
  )}

  {!sectionsLoading && sectionsError && (
    <tr>
      <td colSpan="4">
        Unable to load sections: {sectionsError}
      </td>
    </tr>
  )}

  {!sectionsLoading && !sectionsError &&
    sections.map((section) => (
      <tr key={section.id}>
        <td>{section.courseCode}</td>
        <td>{section.section}</td>
        <td>{section.room}</td>
        <td>{section.instructor}</td>
      </tr>
    ))}

  {!sectionsLoading && !sectionsError &&
    sections.length === 0 && (
      <tr>
        <td colSpan="4">No sections found.</td>
      </tr>
    )}
</tbody>
      </table>
    </div>
  </section>
)}

{activeMenu === "Registrations" && (
  <section className="dashboard-panel">
    <h2>Registrations</h2>

    <div className="student-table-wrapper">
      <table className="student-table">
        <thead>
          <tr>
            <th>Registration ID</th>
            <th>Student ID</th>
            <th>Course</th>
            <th>Section</th>
            <th>Status</th>
          </tr>
        </thead>

        <tbody>
          {registrations.map((registration) => (
            <tr key={registration.id}>
                <td>{registration.id}</td>
                <td>{registration.studentId}</td>
                <td>{registration.course}</td>
                <td>{registration.section}</td>
                <td>{registration.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
)}
      </main>
    </div>
  );
}

export default AdminDashboard;
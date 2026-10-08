import { useState } from "react";

function AdminDashboard() {
const [activeMenu, setActiveMenu] = useState("Dashboard");

const user = JSON.parse(localStorage.getItem("user") || "{}");

const students = Array.from({ length: 25 }, (_, index) => {
const number = String(index + 1).padStart(3, "0");

return {
  studentId: "STU" + number,
  name: "Student " + number,
  email: "student" + number + "@example.test",
  advisor: index < 13 ? "Wendy Lu" : "Zak",
  status: "Active",
};


});

const advisors = [
{
id: "ADV001",
name: "Wendy Lu",
email: "[wendylu@gmail.com](mailto:wendylu@gmail.com)",
students: 13,
status: "Active",
},
{
id: "ADV002",
name: "Zak",
email: "[zak@gmail.com](mailto:zak@gmail.com)",
students: 12,
status: "Active",
},
];

const courses = [
"CSC220",
"CSC353",
"ECO200",
"ENG101",
"ENG102",
"ENG103",
"GEO101",
"HIS101",
"ITE101",
"ITE102",
"ITE104",
"ITE120",
"ITE201",
"ITE210",
"ITE221",
"ITE222",
"ITE224",
"ITE231",
"ITE233",
"ITE240",
"ITE254",
"ITE321",
"ITE331",
"ITE343",
"ITE365",
"ITE368",
"ITE420",
"ITE421",
"ITE441",
"ITE442",
"ITE451",
"ITE475",
"ITE476",
"ITE477",
"ITE479",
"MAT101",
"MAT102",
"MIS103",
"PSY101",
"PSY202",
"SOC221",
"STA101",
"THA101",
];

const sections = [
["CSC220", "1", "Demo Room 301", "Demo Instructor 01"],
["ENG103", "1", "Demo Room 301", "Demo Instructor 02"],
["ITE102", "1", "Demo Room 301", "Demo Instructor 03"],
["ITE254", "1", "Demo Room 301", "Demo Instructor 04"],
["ITE321", "1", "Demo Room 301", "Demo Instructor 05"],
["ITE475", "1", "Demo Room 301", "Demo Instructor 06"],
["MAT101", "1", "Demo Room 301", "Demo Instructor 07"],
["STA101", "1", "Demo Room 301", "Demo Instructor 08"],
["THA101", "1", "Demo Room 301", "Demo Instructor 09"],
];

const registrations = [
{
id: "REG001",
studentId: "STU001",
course: "CSC220",
section: "1",
status: "Registered",
},
{
id: "REG002",
studentId: "STU002",
course: "ENG103",
section: "1",
status: "Registered",
},
{
id: "REG003",
studentId: "STU003",
course: "ITE102",
section: "1",
status: "Registered",
},
];

const menuItems = [
"Dashboard",
"Students",
"Advisors",
"Courses",
"Sections",
"Registrations",
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

    {activeMenu === "Dashboard" && (
      <>
        <section className="welcome-section">
          <h2>Welcome, Administrator</h2>
          <p>
            Manage students, advisors, courses, sections, and
            registrations from the admin panel.
          </p>
        </section>

        <section className="dashboard-cards">
          <div className="dashboard-card">
            <span>Students</span>
            <strong>25</strong>
            <p>Registered students</p>
          </div>

          <div className="dashboard-card">
            <span>Advisors</span>
            <strong>2</strong>
            <p>Active advisors</p>
          </div>

          <div className="dashboard-card">
            <span>Courses</span>
            <strong>43</strong>
            <p>Available courses</p>
          </div>

          <div className="dashboard-card">
            <span>Sections</span>
            <strong>9</strong>
            <p>Course sections</p>
          </div>
        </section>

        <section className="dashboard-panel">
          <h2>Recent Registrations</h2>

          <div className="empty-state">
            <p>No registration data available yet.</p>
            <span>
              Registration data will appear here when connected to
              the backend API.
            </span>
          </div>
        </section>
      </>
    )}

    {activeMenu === "Students" && (
      <section className="dashboard-panel">
        <h2>Students</h2>

        <div className="student-table-wrapper">
          <table className="student-table">
            <thead>
              <tr>
                <th>Student ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Advisor</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {students.map((student) => (
                <tr key={student.studentId}>
                  <td>{student.studentId}</td>
                  <td>{student.name}</td>
                  <td>{student.email}</td>
                  <td>{student.advisor}</td>
                  <td>{student.status}</td>
                </tr>
              ))}
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
            <td>{advisor.students}</td>
            <td>{advisor.status}</td>
        </tr>
          ))}
        </tbody>
      </table>
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
            <th>Credits</th>
            <th>Status</th>
          </tr>
        </thead>

        <tbody>
          {courses.map((course) => (
            <tr key={course}>
              <td>{course}</td>
              <td>4</td>
              <td>Available</td>
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
          {sections.map((section) => (
            <tr key={section[0]}>
              <td>{section[0]}</td>
              <td>{section[1]}</td>
              <td>{section[2]}</td>
              <td>{section[3]}</td>
            </tr>
          ))}
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
import { useEffect, useState } from "react";
import { apiRequest } from "../api.js";

const blank = { courseId: "", termId: "", section: 1, capacity: 30,
  room: "", instructor: "", meetings: [{ day: "Monday", startTime: "08:30", endTime: "12:30" }] };
const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const inputStyle = { padding: "8px", maxWidth: "100%", minWidth: 0 };
const scheduleText = meetings => (meetings || []).map(m =>
  m.day + " " + m.startTime + "–" + m.endTime).join(", ");

export default function OfferingManagement() {
  const [catalog, setCatalog] = useState({ courses: [], terms: [] });
  const [offerings, setOfferings] = useState([]);
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function refresh() {
    const [c, o] = await Promise.all([apiRequest("/advisor/catalog"), apiRequest("/advisor/offerings")]);
    setCatalog(c);
    setOfferings(o.offerings || []);
  }
  useEffect(() => {
    let cancelled = false;
    Promise.all([apiRequest("/advisor/catalog"), apiRequest("/advisor/offerings")])
      .then(([c, o]) => { if (!cancelled) { setCatalog(c); setOfferings(o.offerings || []); } })
      .catch(err => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, []);
  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));
  function edit(row) {
    setEditing(row.id);
    setForm({ courseId: row.courseId, termId: row.termId, section: row.section,
      capacity: row.capacity, room: row.room, instructor: row.instructor,
      meetings: row.meetings.map(m => ({ day: m.day, startTime: m.startTime, endTime: m.endTime })) });
    setError(""); setMessage("");
  }
  function reset() { setEditing(null); setForm(blank); }
  function setMeeting(i, key, value) {
    setForm(f => ({ ...f, meetings: f.meetings.map((m, index) =>
      i === index ? { ...m, [key]: value } : m) }));
  }
  async function save(event) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const body = { ...form, section: Number(form.section), capacity: Number(form.capacity) };
      if (editing) {
        const original = offerings.find(o => o.id === editing);
        if (original) {
          for (const key of ["courseId", "termId", "section", "capacity", "room", "instructor", "meetings"]) {
            const originalValue = key === "courseId" ? original.courseId
              : key === "termId" ? original.termId : original[key];
            if (JSON.stringify(body[key]) === JSON.stringify(originalValue)) delete body[key];
          }
        }
        if (Object.keys(body).length === 0) {
          setMessage("No changes to save."); setBusy(false); return;
        }
      }
      if (editing) {
        await apiRequest("/advisor/offerings/" + editing, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await apiRequest("/advisor/offerings", { method: "POST", body: JSON.stringify(body) });
      }
      await refresh(); reset(); setMessage("Offering saved. Existing registration history is protected.");
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  async function remove(row) {
    if (!window.confirm("Remove " + row.courseCode + " Section " + row.section +
      "? Sections with any registration history cannot be deleted.")) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await apiRequest("/advisor/offerings/" + row.id, { method: "DELETE" });
      await refresh(); setMessage("Unused offering removed.");
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <section className="dashboard-panel" style={{ marginBottom: 24 }}>
    <h2>Course offerings — current term</h2>
    <p>Open a section, edit its details, or remove an unused section. Changes are protected when registrations exist.</p>
    {error && <p role="alert" style={{ color: "#b91c1c" }}>{error}</p>}
    {message && <p role="status">{message}</p>}
    <form onSubmit={save} style={{ display: "grid", gap: 12, marginBottom: 20 }}>
      <h3>{editing ? "Edit offering" : "Create offering"}</h3>
      <div className="management-grid">
        <label>Course <select style={inputStyle} required value={form.courseId}
          onChange={e => set("courseId", e.target.value)}>
          <option value="">Select course</option>
          {catalog.courses.map(c => <option key={c.id} value={c.id}>{c.code} — {c.title}</option>)}
        </select></label>
        <label>Term <select style={inputStyle} required value={form.termId}
          onChange={e => set("termId", e.target.value)}>
          <option value="">Select current term</option>
          {catalog.terms.map(t => <option key={t.id} value={t.id}>{t.code}</option>)}
        </select></label>
        <label>Section <input style={inputStyle} required min="1" type="number" value={form.section}
          onChange={e => set("section", e.target.value)}/></label>
        <label>Seats <input style={inputStyle} required min="1" type="number" value={form.capacity}
          onChange={e => set("capacity", e.target.value)}/></label>
        <label>Room <input style={inputStyle} required value={form.room}
          onChange={e => set("room", e.target.value)}/></label>
        <label>Instructor <input style={inputStyle} required value={form.instructor}
          onChange={e => set("instructor", e.target.value)}/></label>
      </div>
      <fieldset style={{ maxWidth: "100%" }}>
        <legend>Weekly schedule (one 4-hour day, or Mon/Thu or Tue/Fri for two 2-hour days)</legend>
        <label>Meeting pattern <select style={inputStyle} value={form.meetings.length}
          onChange={e => { const split = Number(e.target.value) === 2;
            set("meetings", split ? [
              { day: "Monday", startTime: "08:30", endTime: "10:30" },
              { day: "Thursday", startTime: "08:30", endTime: "10:30" },
            ] : [{ day: "Monday", startTime: "08:30", endTime: "12:30" }]); }}>
          <option value="1">One 4-hour meeting</option><option value="2">Two 2-hour meetings</option>
        </select></label>
        {form.meetings.map((m, i) => <div key={i} className="management-grid" style={{ margin: "10px 0" }}>
          <label>Day <select style={inputStyle} value={m.day} onChange={e => setMeeting(i, "day", e.target.value)}>
            {days.map(day => <option key={day} value={day}>{day}</option>)}
          </select></label>
          <label>Start <input style={inputStyle} type="time" required value={m.startTime}
            onChange={e => setMeeting(i, "startTime", e.target.value)}/></label>
          <label>End <input style={inputStyle} type="time" required value={m.endTime}
            onChange={e => setMeeting(i, "endTime", e.target.value)}/></label>
        </div>)}
      </fieldset>
      <div><button type="submit" disabled={busy}>{busy ? "Saving..." : editing ? "Save offering" : "Create offering"}</button>
        {editing && <button type="button" disabled={busy} onClick={reset}>Cancel edit</button>}</div>
    </form>
    <div className="student-table-wrapper"><table className="student-table"><thead><tr>
      <th>Course</th><th>Term</th><th>Section</th><th>Schedule</th><th>Room</th>
      <th>Instructor</th><th>Seats taken</th><th>Seats remaining</th><th>Actions</th>
    </tr></thead><tbody>
      {offerings.map(row => <tr key={row.id}><td>{row.courseCode} — {row.courseTitle}</td>
        <td>{row.term}</td><td>{row.section}</td><td>{scheduleText(row.meetings)}</td>
        <td>{row.room}</td><td>{row.instructor}</td><td>{row.seatsTaken}</td>
        <td>{row.seatsRemaining}</td><td><button type="button" disabled={busy}
          onClick={() => edit(row)}>Edit</button>{" "}
          <button type="button" disabled={busy} onClick={() => remove(row)}>Remove</button></td>
      </tr>)}
      {offerings.length === 0 && <tr><td colSpan="9">No current-term offerings found.</td></tr>}
    </tbody></table></div>
  </section>;
}

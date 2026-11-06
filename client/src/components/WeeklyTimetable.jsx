import { useState } from "react";
import { buildTimetable, timeLabel } from "../utils/timetable.js";
import "./WeeklyTimetable.css";

export default function WeeklyTimetable({ registrations = [] }) {
  const [view, setView] = useState("week");
  const { events, days, start, end, unavailable } = buildTimetable(registrations);
  const hours = Array.from({ length: (end - start) / 60 }, (_, i) => start + i * 60);
  const terms = [...new Set(registrations.map(r => r.term).filter(Boolean))].join(", ");
  return <section className="dashboard-section timetable-section" aria-labelledby="timetable-title">
    <div className="section-heading">
      <div><p className="eyebrow">Your week at a glance</p><h2 id="timetable-title">Weekly timetable</h2>
        <p className="section-description">{terms ? `Term ${terms} · ` : ""}Recurring class times in Bangkok time</p></div>
      <div className="view-switch" aria-label="Timetable view">
        <button type="button" aria-pressed={view === "week"} onClick={() => setView("week")}>Week</button>
        <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")}>List</button>
      </div>
    </div>
    {!events.length ? <div className="portal-empty"><strong>No classes scheduled yet</strong><p>Your registered classes will appear here once meeting times are available.</p></div>
      : view === "list" ? <div className="schedule-list">{days.map(day => {
        const daily = events.filter(e => e.day === day).sort((a, b) => a.start - b.start);
        return <div className="schedule-day" key={day}><h3>{day}</h3>{daily.length ? daily.map(e =>
          <article key={e.id} className="schedule-list-event"><span>{timeLabel(e.start)}–{timeLabel(e.end)}</span>
            <div><strong>{e.courseCode} · Section {e.section}</strong><p>{e.courseName}</p><small>{e.room}{e.instructor ? ` · ${e.instructor}` : ""}</small></div></article>) : <p className="section-description">No classes</p>}</div>;
      })}</div>
      : <div className="timetable-scroll" role="region" aria-label="Weekly class schedule, scroll horizontally to see all days" tabIndex={0}>
        <div className="timetable" style={{ "--day-count": days.length }}>
          <div className="timetable-corner">Time</div>{days.map(day => <div className="timetable-day-name" key={day}>{day}</div>)}
          <div className="timetable-hours" style={{ height: hours.length * 64 }}>{hours.map(h => <span key={h}>{timeLabel(h)}</span>)}</div>
          {days.map(day => <div className="timetable-column" key={day} style={{ height: hours.length * 64 }}>
            {events.filter(e => e.day === day).map(e => <article className="timetable-event" key={e.id}
              style={{ top: (e.start - start) / 60 * 64, height: (e.end - e.start) / 60 * 64 - 3,
                left: `calc(${e.lane / e.lanes * 100}% + 3px)`, width: `calc(${100 / e.lanes}% - 6px)` }}
              aria-label={`${e.day}, ${timeLabel(e.start)} to ${timeLabel(e.end)}, ${e.courseCode}, section ${e.section}, ${e.room}`}>
              <strong>{e.courseCode}</strong><span>{timeLabel(e.start)}–{timeLabel(e.end)}</span>
              <span className="timetable-event-title">{e.courseName}</span><small>{e.room} · Sec {e.section}</small>
            </article>)}
          </div>)}
        </div>
      </div>}
    {unavailable.length > 0 && <p role="status">Meeting times unavailable for {unavailable.join(", ")}. Check the course details or contact your advisor.</p>}
  </section>;
}

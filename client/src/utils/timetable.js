export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const DAYS = [...WEEKDAYS, "Saturday", "Sunday"];

export function parseTimeRange(value) {
  const match = /^(\d{2}):(\d{2})\s*[-–]\s*(\d{2}):(\d{2})$/.exec(value || "");
  if (!match) return null;
  const [h1, m1, h2, m2] = match.slice(1).map(Number);
  if (h1 > 23 || h2 > 23 || m1 > 59 || m2 > 59) return null;
  const start = h1 * 60 + m1, end = h2 * 60 + m2;
  return end > start ? { start, end } : null;
}

export const timeLabel = minutes => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

export function buildTimetable(registrations = []) {
  const events = [], unavailable = [];
  for (const registration of registrations) {
    if (!registration.meetings?.length) unavailable.push(registration.courseCode);
    for (const [index, meeting] of (registration.meetings || []).entries()) {
      const range = parseTimeRange(meeting.time);
      if (!range || !DAYS.includes(meeting.day)) { unavailable.push(registration.courseCode); continue; }
      events.push({ ...range, day: meeting.day, room: meeting.room || "Room to be confirmed",
        id: `${registration.id}-${index}`, courseCode: registration.courseCode,
        courseName: registration.courseName, section: registration.section,
        term: registration.term, instructor: registration.instructor });
    }
  }
  const days = DAYS.filter(day => WEEKDAYS.includes(day) || events.some(e => e.day === day));
  const start = Math.floor(Math.min(8 * 60, ...events.map(e => e.start)) / 60) * 60;
  const end = Math.ceil(Math.max(18 * 60, ...events.map(e => e.end)) / 60) * 60;
  for (const day of days) {
    const sorted = events.filter(e => e.day === day).sort((a, b) => a.start - b.start || a.end - b.end);
    let cluster = [], clusterEnd = -1;
    const finish = () => {
      const lanes = [];
      for (const event of cluster) {
        let lane = lanes.findIndex(until => until <= event.start);
        if (lane < 0) lane = lanes.length;
        lanes[lane] = event.end;
        event.lane = lane;
      }
      for (const event of cluster) event.lanes = lanes.length;
    };
    for (const event of sorted) {
      if (event.start >= clusterEnd) { finish(); cluster = []; clusterEnd = -1; }
      cluster.push(event); clusterEnd = Math.max(clusterEnd, event.end);
    }
    finish();
  }
  return { events, days, start, end, unavailable: [...new Set(unavailable)] };
}

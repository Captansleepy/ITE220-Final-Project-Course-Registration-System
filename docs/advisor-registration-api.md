# Advisor registration API

All paths below start with `/api/advisor`. Send the existing login token in `Authorization: Bearer <token>`. Only active advisors may use these endpoints, and students must belong to that advisor. IDs are MongoDB `_id` values (the `id` returned by the student list), not display codes such as STU001.

| Method | Path | Purpose |
|---|---|---|
| GET | `/students/:id/registrations` | Current-term active registrations |
| GET | `/students/:id/offerings` | Current offerings, live seats and eligibility reasons |
| POST | `/students/:id/registrations` | Register with JSON `{ "offeringId": "<offering id>" }` |
| DELETE | `/students/:id/registrations/:registrationId` | Drop an active registration |

GET registrations returns `{ registrations: [{ id, status, offering }] }`. POST returns HTTP 201 and `{ registration: { id, status, offering } }`. DELETE returns `{ registration: { id, status: "dropped" } }`.

An offering contains `id`, `courseCode`, `courseTitle`, `credits`, `term`, `section`, `meetings` (day/startTime/endTime), `room`, `instructor`, `capacity`, and `addDropOpen`. GET offerings returns `{ offerings: [...] }` and adds `eligible`, `code`, `reason`, `retakeRequired`, `seatsRemaining`. Failed courses are listed first. Keep blocked offerings visible but disable registration and show their reason. Show retakes with a badge.

After register/drop, reload both lists and the dashboard totals. Disable the action while a request is pending. Display the server's `error.message`; never replace errors with sample data. A second submission may return 409.

## Rules

- Only current, non-finalised terms permit mutations.
- Inactive or unassigned students cannot be registered/dropped.
- Any historical passing grade, including D/D+, excludes the course. W can be repeated. F is flagged for retake until passed; other courses are still permitted.
- Only one section of a course per student/term; capacity and overlapping meeting times are checked server-side. Adjacent meeting times are allowed.
- Advisor actions are allowed while the student add/drop request window is closed. The window concerns student paperwork; term finalisation locks advisor mutations.
- Dropped rows are preserved and reused if the same offering is registered again. Academic grade records are never changed.

Errors use `{ error: { code, message } }`: 400 INVALID_ID/INVALID_INPUT; 404 STUDENT_NOT_FOUND/OFFERING_NOT_FOUND/REGISTRATION_NOT_FOUND; 409 STUDENT_INACTIVE/TERM_CLOSED/ALREADY_PASSED/ALREADY_REGISTERED/OFFERING_FULL/TIMETABLE_CLASH. Authentication returns existing 401/403 errors.

## Transactions and verification

Writes use MongoDB transactions and a shared `Term.registrationRevision` update to serialize decisions about seats and clashes. Existing term documents acquire this field on their first successful mutation; no reseeding is required. Atlas supports transactions. A standalone MongoDB server does not; use a replica set. All other future registration-writing code must use the same transaction/term-lock pattern.

Run `node --test server/tests/*.test.js` from the repository root. Tests use fake data only, including a serialized transaction harness; they do not modify Atlas. They verify rules, controller mutations, ownership denial, finalisation and reuse. The concurrency test verifies the controller transaction boundary, not a real MongoDB deployment.

Before merging, use a disposable test student and current offering on the development database: register, refresh, verify advisor/student views, drop, refresh, verify the seat returns, and re-register. Test a passed course and a timetable conflict. Do not reseed the shared database.

This change does not create/edit offerings, open/close add/drop windows, finalise terms, or provide the downloadable student add/drop form. Those are separate remaining workflows.

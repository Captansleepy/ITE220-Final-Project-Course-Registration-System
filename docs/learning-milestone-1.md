# Milestone 1 learning notes

## What we changed

The submitted group project is still in its original folder. This copy has its own Git branch. We preserved history, connected origin to MohanBro/course-registration-side-project and explicitly disabled pushes to upstream. Nothing has been committed or pushed yet.

## CSS variables are the shared design vocabulary

Open client/src/index.css. The :root block defines --navy, --teal, --muted and --border. These are CSS custom properties. `color: var(--teal)` reuses the same color across buttons, links and timetable accents. Changing a token updates related components without searching for dozens of color literals. Shared inputs/buttons/focus styles establish consistent interaction; screen-specific CSS controls layout.

client/src/pages/Login.css builds a two-column layout on desktop and stacks it on mobile. App.css supplies shared management workspace styling. StudentDashboard.css styles the student overview. This first pass keeps existing functional components; later we can split their large screens into smaller pages.

## How the timetable works

The current GET /api/student/dashboard response already contains registered courses and their meetings. We do not add a second database copy of the timetable. StudentDashboard passes registrations to WeeklyTimetable.

client/src/utils/timetable.js turns meeting time strings into minutes after midnight. Example: 08:30 becomes 510. A course meeting Monday and Thursday creates two visual events with distinct keys. Unknown days/times are reported rather than invented. Weekend columns are added if present. Time bounds expand for early/late classes.

Overlapping events get separate lanes so legacy conflicting data remains visible; this is presentation logic, not permission to register overlapping courses. Backend clash rules still govern registration.

client/src/components/WeeklyTimetable.jsx renders a recurring week grid and a day-by-day list. React useState stores the selected view. Events use vertical offset and height derived from duration: one hour equals 64 display pixels. Switching view changes local UI only, not enrollment. On mobile the grid can scroll inside its container; List is the compact alternative.

## What the four tests prove

Split weekly meetings remain separate events; legacy overlaps are visible while adjacent meetings can share a lane; early/late/weekend classes are not hidden; invalid or missing times produce a notice. They do not prove live database login or registration integration.

Browser fixture checks exercise login validation/navigation, timetable/list switching and desktop/mobile rendering of Login, Student, Admin Accounts and Advisor. Those fixtures contain invented people and schedules and intercept API traffic before it reaches any real service.

## Why the ports changed

The personal frontend uses 5174, and its API address defaults to 5002. The original application uses different defaults. A distinct frontend origin also gives separate browser localStorage so testing this copy does not reuse the group's saved session. It still requires its own server environment/database before real login works.

## Review exercise

Find --teal in index.css and identify three places that use it. Trace `data.registrations` from StudentDashboard into WeeklyTimetable and then buildTimetable. Explain why a Monday/Thursday class produces two events but remains one registration. Finally, switch to List on a phone-width screen and compare it with the grid.

## Not implemented yet

There is no new in-app request model, pending-request inbox or password-reset endpoint in this milestone. Existing email/PDF instructions remain. See development-roadmap.md for the agreed next stages.

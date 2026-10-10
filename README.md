# Course Registration System — CSC220 / ITE220

MERN final group project, Stamford International University, Trimester 1 / 2026.

**Group number:** _Confirm and enter the registered LMS group number._

## Team

| Member | Student ID | Role |
|---|---|---|
| Rachaphon Bhetcharut | 2306020001 | Team lead / integration |
| Sham Bahadu | 230710005 | Express API / registration rules |
| Panruethai Thubthimthong | 2303080018 | Data and MongoDB |
| Hathairat Deesrisuk | 2105110008 | Admin and Advisor React |
| Trithep Sik | 2406100007 | Login and Student React |

## Features

- JWT + bcrypt login, protected admin/advisor/student routes.
- Admin: list accounts, filter roles, create accounts for all roles, edit details, safely deactivate accounts with confirmation.
- Advisor: assigned students and academic history, eligible-course rules, register/drop students, create/edit/remove unused offerings, view occupied/remaining seats, manage add/drop deadlines.
- Student: current registrations, instructor/room/schedule, historical grades and earned credits, F retake warnings, downloadable Add/Drop PDF, advisor email instructions.
- Add/drop **requests are paperwork**, not automatic registration updates. The student sends the filled/signed PDF; advisor performs any approved registration change.
- Eligible-course rules cover passing grades, F retakes, term availability, full sections, duplicate registration and overlapping meeting times.

**Limitations:** Deleting accounts is implemented as safe deactivation to preserve student history; registered offerings cannot be deleted or have their course/term/section/schedule changed. This is intentional data preservation. Real Atlas transaction concurrency and clean-database setup require verification in a separate environment. Full browser/accessibility testing has not been completed.

## Install and run locally

Requires Node.js version supporting `--env-file`, MongoDB Atlas, and two terminals.

1. Clone the repository and install dependencies:

   ```powershell
   git clone https://github.com/Captansleepy/ITE220-Final-Project-Course-Registration-System.git
   cd ITE220-Final-Project-Course-Registration-System
   cd server
   npm ci
   Copy-Item .env.example .env
   ```

2. Edit `server/.env` locally. Supply `MONGODB_URI`, `MONGODB_DB_NAME`, `JWT_SECRET` (32+ characters), `CLIENT_ORIGIN=http://localhost:5173`, and `PORT=5001`. Do not commit credentials. Use an isolated Atlas database for testing, not the team's shared populated database.

3. From `server`: `npm run dev`. This starts the API at `http://localhost:5001` by default.

4. Second terminal:

   ```powershell
   cd client
   npm ci
   Copy-Item .env.example .env
   ```

   In `client/.env` set `VITE_API_URL=http://localhost:5001/api`; then run `npm run dev` and open `http://localhost:5173`.

The `Connected to course-registration-api` health message checks only the API endpoint. Log in and verify database-backed screens separately.

## Seed a fresh development database only

**Never run a seed import against `course_registration_seed_panruethai` or any populated database.**

For a NEW EMPTY MongoDB Atlas database named `course_registration_seed_<testname>`, set `MONGODB_DB_NAME` to that new name and set `SEED_PASSWORD` locally to a demo password of 12+ characters. The seed refuses any database that already has collections.

From `server`:

```powershell
npm run seed:preview
npm run seed
```

The seed loads `CSC220-Project-Info_final_1.xlsx` plus `seed-config.json`. The workbook **must contain fictional names and emails**; inspect its anonymization before applying the seed.

Expected historical initial import: 25 students, 2 advisors, 1 admin; 43 courses, 10 terms, 9 offerings, 237 academic records, 13 registrations. Counts can differ after development activity. The rubric's example counts are not literal required totals.

## Demo accounts

The seed uses one locally chosen `SEED_PASSWORD` for demo accounts. Do not publish live/shared credentials. In your isolated seeded database:

| Role | Login email | Password |
|---|---|---|
| Admin | admin@example.test | local `SEED_PASSWORD` |
| Advisor | Consult fictional advisor entry from `server/seed-config.json` | local `SEED_PASSWORD` |
| Student | Consult a fictional student's email in your anonymized workbook | local `SEED_PASSWORD` |

Set up role-specific accounts and share actual demo credentials securely with the lecturer. Never commit passwords or JWTs.

## Run tests

From `server`: `npm test`. From `client`: `npm run build` and `npm run lint`. Use a separate demo database for any mutation test.

The four backend test files exercise auth, assigned students, student dashboard and registration eligibility/window rules. Passing tests do not prove a live Atlas deployment is working.

## Dashboard screenshots

Before submission, add actual screenshots from all three working role dashboards here. Do not use mock screenshots as evidence.

- Admin: _Screenshot pending_
- Advisor: _Screenshot pending_
- Student: _Screenshot pending_

## Design and submission

The relationship diagram, 3–5-page group report and individual peer evaluations must be submitted according to LMS instructions; verify them separately. `docs/advisor-registration-api.md` and `docs/student-add-drop.md` document workflows.

## Development and AI assistance

AI tools were used as coding and documentation assistance. Developers must verify generated code and be able to explain the relevant logic during the presentation. Identify precise contributions and validation in the group report.

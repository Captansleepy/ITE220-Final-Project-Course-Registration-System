# Course Portal

Personal continuation by Sham Bahadu, built on the team's submitted Course Registration System. The personal version adds a light navy-and-teal interface, a weekly student timetable, fictional demo data, in-app advisor-reviewed Add/Drop requests and password recovery. It runs locally for development; it is not a deployed service and is not ready for real student records.

## What's included

**Interface and timetable**
- Redesigned sign-in with a responsive layout, navy/teal colors and accessible focus states, plus shared styling for the Admin and Advisor workspaces.
- Student weekly timetable built from the existing dashboard data, with Week/List views, multiple weekly meetings, weekend classes and clear handling of missing schedules. Overlapping legacy meetings are shown side by side; backend registration rules still decide what is allowed.

**Add/Drop requests**
- Students submit Add/Drop requests inside the website, cancel pending ones and read advisor decisions.
- Advisors have a pending inbox. Approval updates registration in one step using the existing course rules. See [request workflow and tests](docs/in-app-requests.md).

**Password recovery**
- "Forgot your password?" on the sign-in page leads to a Forgot Password page and an emailed link to a Reset Password page.
- The request gives the same reply whether or not the email is registered. Only active accounts receive a link.
- Links work once, for 30 minutes. A newer link cancels older ones. Only a hash of each link is stored.
- Requests are rate-limited per computer and per email address.
- A successful reset, or an admin changing someone's password, signs that user out of every existing session.
- When a signed-in page is refused (expired session, changed password or deactivated account), the website returns to sign-in with a short notice.
- **Email is development-only for now.** With `MAIL_TRANSPORT=console` the email, including the link, is printed in the backend terminal instead of being sent. No real email provider is configured yet, and demo addresses ending in `.test` cannot receive mail.

## Local isolation

This personal checkout is separate from the submitted team folder and uses its own MongoDB Atlas database and credentials. The frontend runs on localhost:5174 and the API on localhost:5002/api. These differ from the team's ports, so browser logins are kept separate.

Remotes: `origin` is https://github.com/MohanBro/course-registration-side-project.git; `upstream` is the original team repository, kept for reference with its push URL set to DISABLED. `main` holds the merged work, and new work happens on `feature/...` branches merged through pull requests.

Local `main` still tracks `upstream/main`, so update it explicitly from your own repository:

```bash
git checkout main
git pull --ff-only origin main
```

## Backend setup

Copy `server/.env.example` to `server/.env`, then set your own MongoDB URI, a separate personal database name, a new JWT secret and a demo password. Keep `MAIL_TRANSPORT=console` for local password-reset testing. Never reuse the team's database or secrets, and never commit `server/.env`.

Demo data: `npm run demo:preview --prefix server` shows what would be created without connecting. `npm run demo:seed --prefix server` fills a **new, empty** personal database with fictional people and histories; it refuses to run over existing data. See [demo accounts and scenarios](docs/demo-data.md).

The inherited workbook `server/CSC220-Project-Info_final_1.xlsx` is still in the repository. Its first 17 histories were reported as based on real academic records. The demo seed does not read it.

## Run the portal

Use two terminals:

```bash
cd server && npm run dev        # API on http://localhost:5002
npm run dev --prefix client     # website on http://localhost:5174
```

Open http://localhost:5174. The backend reads `.env` from the `server` folder, so start it from there. Install dependencies first with `npm ci --prefix client` and `npm ci --prefix server` if needed.

## Checks

Offline checks (no database needed). GitHub Actions runs these on pushes and pull requests:

```bash
npm test --prefix server          # 63 backend tests
npm test --prefix client          # 7 tests: timetable and password form
npm run lint --prefix client
npm run build --prefix client
```

Live Atlas checks. Each one creates a brand-new temporary database, runs the real server against it and deletes it afterwards. Your demo database is not touched.

```bash
npm run test:requests:integration --prefix server   # Add/Drop requests
npm run test:sessions:integration --prefix server   # password change ends old sessions
npm run test:reset:integration --prefix server      # password reset flow
```

The older inherited `test:integration` script works differently and keeps its test database; inspect it before running.

## Learn and continue

- [Milestones and feature decisions](docs/development-roadmap.md)
- [What changed and how the timetable works](docs/learning-milestone-1.md)
- [In-app request workflow](docs/in-app-requests.md)
- [Demo accounts and scenarios](docs/demo-data.md)
- [Original group README](docs/original-group-readme.md)

## Attribution

The original course project was built by Rachaphon Bhetcharut, Sham Bahadu, Panruethai Thubthimthong, Hathairat Deesrisuk and Trithep Sik. Original repository: https://github.com/Captansleepy/ITE220-Final-Project-Course-Registration-System. Its Git history is preserved. The redesign and later personal additions are described separately rather than presenting the entire inherited application as solo work.

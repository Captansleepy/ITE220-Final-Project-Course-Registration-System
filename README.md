# Course Portal

Personal continuation by Sham Bahadu, built on the team's submitted Course Registration System. The personal version includes a light navy-and-teal interface, a weekly student timetable, fictional demo data and in-app advisor-reviewed Add/Drop requests. This is a local development branch, not a deployed service.

## Current milestone

- Redesigned login with responsive layout, consistent typography, navy/teal colors and accessible focus states.
- Shared styling for the existing Admin and Advisor workspaces.
- Student weekly timetable drawn from the existing authenticated dashboard response, with Week/List switching, multiple weekly meetings, weekend support and handling for missing schedules.
- Overlapping legacy meetings are displayed side by side; the backend registration rules remain authoritative.
- No new runtime dependencies. Four timetable logic tests are included.

Students can now submit Add/Drop requests inside the website, cancel pending requests and read advisor decisions. Advisors have a pending inbox; approval atomically updates registration using the existing course rules. See [request workflow and tests](docs/in-app-requests.md). Password recovery is still planned. This version is not ready for real student records.

## Local isolation

This personal checkout is separate from the submitted team folder. Its local configuration uses a separately configured personal database and credentials. Frontend defaults to localhost:5174; backend API address defaults to localhost:5002/api. These differ from the team's default ports and keep browser login storage on a separate origin.

The upstream remote points to the original team repository for reference; its push URL is DISABLED. The origin remote points to https://github.com/MohanBro/course-registration-side-project.git. Branch: feature/portal-redesign.

## Run the frontend

From this folder:

```bash
npm ci --prefix client
npm run dev --prefix client
```

Open http://localhost:5174. Keep the frontend running in one terminal and run `npm run dev --prefix server` in another. The local personal Atlas setup and fictional demo support all three roles; see [demo accounts and scenarios](docs/demo-data.md).

## Personal backend and demo setup

Copy server/.env.example to server/.env locally, then configure your own MongoDB URI, a separate personal database and a new JWT secret. Never reuse the team's database or secrets. The original seed/workbook remains inherited reference material. Its first 17 histories were reported as based on real academic histories; the dedicated `demo:seed` command generates independent fictional histories without reading that workbook. Use `npm run demo:preview --prefix server` first, and `npm run demo:seed --prefix server` only for a new empty personal database. Never rerun it over existing data. No shared database was modified for this milestone.

With your personal backend configured, use npm run dev --prefix server on port 5002. The copied environment example sets CLIENT_ORIGIN to http://localhost:5174. Node's environment loading requires the server working directory for the current scripts; run `cd server` then `npm run dev` if starting through npm --prefix does not resolve your local file as expected.

## Checks

```bash
npm run test --prefix client
npm run lint --prefix client
npm run build --prefix client
npm test --prefix server
```

The last command runs inherited unit/fixture tests, not a live Atlas acceptance run. The inherited integration command creates a separate retained Atlas test database; do not run it until personal credentials and the replacement synthetic dataset are ready.

## Learn and continue

- [Milestones and feature decisions](docs/development-roadmap.md)
- [What changed and how the timetable works](docs/learning-milestone-1.md)
- [In-app request workflow](docs/in-app-requests.md)
- [Original group README](docs/original-group-readme.md)

## Attribution

The original course project was built by Rachaphon Bhetcharut, Sham Bahadu, Panruethai Thubthimthong, Hathairat Deesrisuk and Trithep Sik. Original repository: https://github.com/Captansleepy/ITE220-Final-Project-Course-Registration-System. Its Git history is preserved. The redesign and subsequent personal additions should be described separately in the project documentation rather than presenting the entire inherited application as solo work.

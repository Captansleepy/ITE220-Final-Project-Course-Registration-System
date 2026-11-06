# Personal demo data

This dedicated generator reads no workbook and copies no student histories. The nine curriculum codes/titles and four-credit rule follow the existing project. Schedules, people, grades, assignments and registrations are fictional. It validates the implementation's rules, not independently verified university policy. The demo has no invented prerequisite or credit-limit rules.

From the project root:

```
npm run demo:preview --prefix server
npm run demo:seed --prefix server
```

Preview does not connect to MongoDB. Apply accepts only `course_registration_seed_personal_dev` and refuses any existing collection. It never clears or replaces data. Run it once, without other seed processes. Rows are inserted in a transaction; indexes are created afterward. If a failure occurs, inspect the database before retrying; do not delete data blindly.

All active demo accounts use the local `SEED_PASSWORD`, stored as a bcrypt hash. These shared demo credentials are for development only.

| Account | Purpose |
|---|---|
| admin@example.test | One admin, including last-admin safeguards |
| advisor001@example.test | Assigned DEMO001–DEMO013 |
| advisor002@example.test | Assigned DEMO014–DEMO025; cannot manage the first advisor's students |
| student001@example.test | Two active registrations and varied eligibility cases |
| student002@example.test | F subsequently passed; occupies the full THA101 offering |
| student004@example.test | Previously dropped STA101, eligible to register again |
| student025@example.test | Inactive account; login should fail |

There are 25 students, two advisors, one admin, nine courses, three terms, 52 academic records, ten offerings and five registration rows (four active, one dropped). Current term is the run's UTC year followed by `-1`; two earlier terms are finalised. This is a demo label, not an official academic calendar.

For DEMO001, CSC220/ENG103 are already registered; ITE102 (A) and ITE475 (D) are blocked as passed; ITE254 section 1 is an eligible F retake; ITE321 is eligible after W. ITE254 section 2 clashes with CSC220 but uses a separate room/instructor. THA101 is full (capacity one). Every offering has four teaching hours per week. CSC220's request window starts open until seven days after seeding; other windows start closed. Advisor registration/drop follows the existing backend policy and is separate from the student's request-window display.

Student pages now use the [in-app request workflow](in-app-requests.md), implemented separately from the seed. The PDF remains optional. Demo addresses end in `.test` and do not receive real email. Password recovery is still planned.

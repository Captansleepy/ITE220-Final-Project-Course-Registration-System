# In-app Add/Drop requests

Implemented 6 November 2026 in the personal Course Portal checkout. Students submit a reason inside the portal; advisors review a queue from their currently assigned students. This replaces the email-instruction panel as the main request flow. The PDF remains an optional download; there is no file upload or automatic email delivery.

## Workflow and policy

- Submission requires an active student with an active assigned advisor, a current nonfinalised term, an open offering flag and a future closing timestamp.
- Add requests must currently satisfy the existing passing-grade, duplicate-course, capacity and timetable rules. Drop requests require an active registration for that exact offering.
- Only one pending request per student/offering is allowed, regardless of action. A partial unique MongoDB index enforces this alongside transactional checks.
- Pending requests reserve no seats and do not modify enrollment. Students may cancel only their own pending requests. Resubmission is allowed after rejection/cancellation/resolution.
- Approval rechecks the current assignment, active student, window/deadline and current eligibility. The registration mutation and approved status commit together in one transaction. Repeated approval by the same reviewer returns success without applying the change twice. Competing approval/cancellation or last-seat approvals use MongoDB transaction conflicts and retries.
- An unsuccessful approval leaves the request pending and does not change enrollment. The advisor may fix the cause and retry, or reject with an explanation of at least five characters.
- Rejection is permitted after the window closes and for inactive students. Rejection never modifies enrollment. Reasons and responses have a 1000-character limit.
- Reassignment transfers queue visibility and review authority to the student's current advisor. The original advisor ID is retained in submittedAdvisor for audit; reviewedBy/resolvedAt record the decision. The former advisor loses access.
- Each inbox shows up to 200 recent requests and an exact pending count. Pending cards are displayed first within that returned set. Full history pagination is a future improvement.
- Both workspaces poll every 15 seconds and have a Refresh requests button. A newly approved status refreshes the student's dashboard/timetable; advisor approval refreshes offering seat counts and the currently selected student's registrations. Deadlines update locally every second in the request panel. The current-registration summary retains its existing 30-second clock.
- Notifications are the in-page pending count and request statuses. There is no browser push, email monitoring, email delivery or background notification service.

## Backend

`server/src/models/AddDropRequest.js` stores student, offering, action, reason, status, original advisor, reviewer, response and timestamps. Server startup creates its indexes after connecting and before listening; existing demo records are preserved. No seed rerun is required.

`server/src/controllers/requestController.js` handles options, lists, submission, cancellation and review. Authentication/role middleware precedes all request routes. Students cannot choose a different student identity in payloads. Advisors query current assignments. Request responses expose public course/student fields, never credentials.

`server/src/controllers/registrationController.js` now exposes registerInSession/dropInSession internally so direct advisor actions and request approvals share the same eligibility/transaction code. The direct advisor endpoints retain their original window policy; a request approval additionally requires the request window to be open. The term registrationRevision lock serialises registration writes; student/offering writes conflict with concurrent assignment, account, capacity and window changes.

| Endpoint | Role | Purpose |
|---|---|---|
| GET /api/student/request-offerings | Student | Current offerings with eligibility, window, active registration and pending flags |
| GET /api/student/requests | Student | Own request history and pending count |
| POST /api/student/requests | Student | offeringId, action (add/drop), reason |
| POST /api/student/requests/:requestId/cancel | Student | Cancel own pending request |
| GET /api/advisor/requests | Advisor | Current assigned students' requests and pending count |
| POST /api/advisor/requests/:requestId/review | Advisor | decision (approved/rejected), response |

## Manual check with the existing demo

The initial seven-day seed deadline may have expired. Log in as advisor001@example.test, select Demo Student 001, and open ITE254 Section 1's Add/Drop window with a future Bangkok deadline. Do not choose Section 2: it intentionally clashes with CSC220.

1. Log in as student001@example.test. Choose Add ITE254 Section 1, enter a reason and submit. Enrollment must stay unchanged while pending.
2. Log in as advisor001@example.test. The inbox should show one pending request. Advisor002 should not see it.
3. Approve. Check offering seats and student timetable: Tuesday 08:30–12:30 appears. The outstanding F remains until a passing academic grade is recorded.
4. Submit a Drop for the same offering as the student; approve as the advisor. The meeting disappears and a seat is released.
5. Test cancellation and rejection separately. Neither should change registrations; rejection requires a response visible to the student.
6. Close/expire the window and confirm submission/approval is unavailable. A request that became stale must stay pending after a failed approval.

Use the existing local demo password. Demo email addresses do not deliver real mail.

## Automated validation

Run `npm test --prefix server`, `npm test --prefix client`, `npm run build --prefix client` and `npm run lint --prefix client` from the project root.

Backend coverage includes role/identity scopes over HTTP, duplicate submissions, pending without reservation, approval/drop, rejection, cancellation, changed eligibility, current advisor reassignment, deadline expiry, retry idempotency and simulated transactional rollback. Browser fixtures exercise form submission, advisor review, pending count, dashboard reload and mobile layout. On 6 November 2026 the isolated Atlas acceptance run passed submission, deduplication, scopes, repeated approval, rejection/cancellation, add/drop dashboard updates, concurrent last-seat approvals, expiry and advisor reassignment. Its temporary database was removed, and the existing demo database was untouched. Run `npm run test:requests:integration --prefix server` to repeat this using personal Atlas credentials: it creates and removes only a fresh `portal_req_check_<random>` database. It does not seed or reset the main demo. These tests use no real academic histories.

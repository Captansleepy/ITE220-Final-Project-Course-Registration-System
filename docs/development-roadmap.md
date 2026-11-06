# Course Portal development roadmap

Goal: a polished course portal that can be prepared for real use later. Working style: implement one complete milestone, review the result and code together, then advance. Do not treat this document as a claim that future milestones exist already.

## Milestone 1 — Interface foundation and timetable

Implemented locally on 28 October 2026: separate checkout and branch; upstream push disabled; no inherited local environment files; separate ports; navy-and-teal theme; redesigned login and consistent workspace styling; a student recurring timetable with Week/List view and schedule edge-case tests. Screenshots and browser tests use invented API fixtures. Neither the shared database nor the submitted folder was edited.

Still to do within the wider redesign: a shared navigation shell for every role, route-based workspace navigation rather than large dashboard pages, account forms and status components, and more concise mobile course views. The current styling is a first pass over the existing screens, not the final information architecture.

## Milestone 2 — Personal repository and development data

The GitHub fork MohanBro/course-registration-side-project is connected as origin. The current branch is feature/portal-redesign; the team repository remains upstream with pushes disabled. A personal MongoDB database with new secrets and a dedicated fictional demo generator was configured and verified on 28 October 2026. The student, advisor and admin flows were manually verified with Sham. Add a convenient repeatable local demo setup and verify real logins, timetable data and inherited registration/drop behavior. Preserve original history and team attribution. Do not publish real records or credentials.

## Milestone 3 — Requests inside the website

Implemented locally on 6 November 2026. See [workflow, decisions and manual tests](in-app-requests.md). Windows must be open at submission and approval; reassignment transfers review authority to the current advisor. The PDF remains an optional download; in-page pending counts poll every 15 seconds.

Replace reliance on email tracking with persisted requests. A student chooses Add or Drop, selects an offering/registration and provides a reason. A request stores student, assigned advisor, action, offering, reason, pending/approved/rejected/cancelled state, timestamps and decision information. Clarify future rules around requests outside windows and approval when an advisor is reassigned.

Students can view their own requests; advisors see pending requests only for assigned students. The pending count on the website comes from saved request state, not from watching anyone's email. Approval must recheck current term, assignment, account status, capacity, history, duplicates and clashes. Approval and registration mutation must be atomic and idempotent so a double-click cannot apply twice. Submission alone never reserves a seat or changes enrollment. Rejection preserves the reason and audit trail. Tests cover unauthorized access, stale requests and competing approvals. Document whether the PDF remains an optional attachment; do not implement file upload without a clear need.

## Milestone 4 — Password recovery

Add a forgot-password page and request endpoint with the same outward response for registered and unregistered emails. Generate a cryptographically random token, store only its hash with expiry, rate-limit requests and make reset single-use. Use an actual configured mail provider before claiming email delivery works; development-only mail capture must be labelled and must not expose tokens in production responses. Resetting must invalidate older sessions. The existing JWT/account middleware needs a session-version or password-change-time strategy, because merely replacing passwordHash does not revoke existing JWTs. Test expiry, reuse, concurrent reset attempts, enumeration resistance and invalidation.

## Milestone 5 — Public release

Run both role workflows and mobile/keyboard checks. Add continuous checks for the new frontend tests, integration tests against isolated data, accessibility checks and request/reset paths. Document your own contributions, architecture, screenshots and known limitations. Choose hosting and mail delivery after the main flow is stable. Real use needs a separate readiness review covering identity/account onboarding, backups, monitoring, HTTPS, actual institutional policies, data handling and recovery procedures. Do not equate a polished interface with production readiness.

## Next review with Sham

The personal Atlas setup and demo account workflows have been verified with Sham. Test the new in-app request flow next, including an add, a drop, a rejection and a cancellation. Password recovery is the next development milestone. No commit, push or publication is implied by the local implementation.

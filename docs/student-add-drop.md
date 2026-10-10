# Student Add/Drop requests

The student dashboard provides a fillable, one-page PDF at `/forms/add-drop-request.pdf`. The form is served by Vite from `client/public/forms/` and copied into production builds. A student completes, signs and emails it; no automatic registration mutation or outgoing email is performed.

Each current registration shows its instructor, add/drop status and closing date (Bangkok time). Clicking Request add/drop on an open course reveals the required completion instructions and the exact subject `Add/Drop Request - <Student ID> - <Course Code>`. The email link fills the assigned advisor address and subject; the student attaches the signed PDF manually.

Advisor contact is resolved on the server from the authenticated student's assignment, restricted to active advisors, and returned as name/email only. Missing contact is displayed explicitly.

Offering.addDropClosesAt is an optional Date. Missing legacy dates show 'Not set - confirm with your advisor'. Finalised terms, false flags and expired deadlines are displayed as closed. Advisors can open/update or close windows from the Available Offerings table. PATCH `/api/advisor/offerings/:offeringId/add-drop` accepts `{ addDropOpen: boolean, addDropClosesAt: ISO timestamp }`; opening requires a future date with timezone. Changes apply to all students in that offering, and current/non-finalised term checks and the existing transaction lock apply. Closing preserves the prior deadline. Students/admins are denied by advisor role middleware. No deadlines are invented or seeded.

Verification: run `node --test server/tests/*.test.js`, `npm run build --prefix client`, and `npm run lint --prefix client`. For manual testing, log in as a student, download/open/save the PDF, confirm advisor contact, and check that closed courses have no Request button. Test an open offering with a future deadline in an isolated test dataset, then confirm the instructions and mailto subject; do not change shared live offering settings solely for a test.

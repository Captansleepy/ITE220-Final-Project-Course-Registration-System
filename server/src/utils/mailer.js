// Sends password-reset emails.
//
// MAIL_TRANSPORT in server/.env chooses how:
//   "console"  - DEVELOPMENT ONLY. Prints the email in the server terminal
//                instead of sending it. Nothing is really emailed.
//   "memory"   - TESTS ONLY. Keeps emails in a list the test can read.
//   (unset)    - No email is sent at all; the server logs that mail is off.
//
// A real email provider is not set up yet. It will be added in a later
// milestone. The two test modes are refused when NODE_ENV=production.

export const sentEmails = []; // filled only by the "memory" transport

export function createMailer(transport = process.env.MAIL_TRANSPORT) {
  const isProduction = process.env.NODE_ENV === "production";

  if ((transport === "console" || transport === "memory") && isProduction) {
    throw new Error(`MAIL_TRANSPORT=${transport} cannot be used in production.`);
  }

  if (transport === "console") {
    return {
      name: "console",
      async send(email) {
        console.log(
          "\n===== DEVELOPMENT EMAIL (not really sent) =====\n" +
          `To: ${email.to}\n` +
          `Subject: ${email.subject}\n\n` +
          `${email.text}\n` +
          "===============================================\n"
        );
      },
    };
  }

  if (transport === "memory") {
    return {
      name: "memory",
      async send(email) {
        sentEmails.push(email);
      },
    };
  }

  if (transport === undefined || transport === "") {
    return {
      name: "disabled",
      async send() {
        console.warn("Password reset requested, but email is not configured (MAIL_TRANSPORT is empty).");
      },
    };
  }

  throw new Error(`Unknown MAIL_TRANSPORT: ${transport}`);
}

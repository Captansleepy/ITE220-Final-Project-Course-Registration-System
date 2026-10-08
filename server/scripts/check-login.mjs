import { createInterface } from "node:readline/promises";

const terminal = createInterface({
  input: process.stdin,
  output: process.stdout,
});

try {
  const email = await terminal.question("Student email: ");
  const password = await terminal.question(
    "Demo password (visible while typing): "
  );

  const login = await fetch("http://localhost:5001/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await login.json();
  console.log("Login status:", login.status);

  if (!login.ok) {
    console.log(data.error);
  } else {
    const profile = await fetch("http://localhost:5001/api/auth/me", {
      headers: { Authorization: `Bearer ${data.token}` },
    });

    const result = await profile.json();
    console.log("Profile status:", profile.status);
    console.log("Role:", result.user?.role);
    console.log("Student ID:", result.user?.studentId);
  }
} catch (error) {
  console.error("Test failed:", error.message);
} finally {
  terminal.close();
}
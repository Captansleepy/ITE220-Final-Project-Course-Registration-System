const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:5002/api"
).replace(/\/$/, "");

export async function apiRequest(path, options = {}) {
  const token = localStorage.getItem("token");

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => null);

  // A signed-in request was refused: the session expired, the password was
  // changed or the account was deactivated. Clear the saved login and go back
  // to the sign-in page with a short explanation.
  if (response.status === 401 && token && !path.startsWith("/auth/")) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.replace("/?session=ended");
  }

  if (!response.ok) {
    const error = new Error(
      data?.error?.message ||
        `Request failed with status ${response.status}.`
    );
    error.status = response.status;     // e.g. 400, 429
    error.code = data?.error?.code;     // e.g. "INVALID_RESET_LINK"
    throw error;
  }

  return data;
}

export async function login(email, password) {
  return apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
    }),
  });
}

// Asks the server to email a reset link. The reply is the same for every email.
export async function requestPasswordReset(email) {
  return apiRequest("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

// Saves a new password using the token from the emailed link.
export async function resetPassword(token, password) {
  return apiRequest("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, password }),
  });
}

export async function getCurrentUser() {
  return apiRequest("/auth/me");
}

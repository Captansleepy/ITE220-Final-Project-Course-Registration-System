const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

// Helper function for API requests
async function request(endpoint, options = {}) {
  const token = localStorage.getItem("token");

  const config = {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  };

  // Add JWT token if the user is logged in
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, config);

  let data;

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(data.message || "Something went wrong");
  }

  return data;
}

// LOGIN
export async function login(email, password) {
  return request("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
    }),
  });
}

// GET CURRENT STUDENT REGISTRATIONS
export async function getMyRegistrations() {
  return request("/me/registrations");
}

// GET CURRENT STUDENT ACADEMIC RECORD
export async function getMyRecord() {
  return request("/me/record");
}

// GET COURSE OFFERINGS
export async function getOfferings(term) {
  return request(`/offerings?term=${encodeURIComponent(term)}`);
}

export default {
  login,
  getMyRegistrations,
  getMyRecord,
  getOfferings,
};
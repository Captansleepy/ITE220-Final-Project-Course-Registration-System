import AdvisorDashboard from "./pages/AdvisorDashboard";
import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { apiRequest } from "./api";
import Login from "./pages/Login";
import AdminDashboard from "./pages/AdminDashboard";
import ProtectedRoute from "./components/ProtectedRoute";

function StudentDashboard() {
  return (
    <main>
      <h1>Student Dashboard</h1>
      <p>Welcome to the Student Dashboard.</p>
    </main>
  );
}

function App() {
  const [connection, setConnection] = useState({
    loading: true,
    message: "",
    error: "",
  });

  useEffect(() => {
    const controller = new AbortController();

    async function checkConnection() {
      try {
        const data = await apiRequest("/health", {
          signal: controller.signal,
        });

        if (data?.status !== "ok") {
          throw new Error("The API returned an unexpected response.");
        }

        setConnection({
          loading: false,
          message: `Connected to ${data.service}`,
          error: "",
        });
      } catch (error) {
        if (controller.signal.aborted) return;

        setConnection({
          loading: false,
          message: "",
          error: error.message,
        });
      }
    }

    checkConnection();

    return () => controller.abort();
  }, []);

  return (
    <>
      {connection.loading && (
        <p role="status">Checking API connection...</p>
      )}

      {connection.message && (
        <p role="status">{connection.message}</p>
      )}

      {connection.error && (
        <p role="alert">
          Could not connect to the API: {connection.error}
        </p>
      )}

      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />

          <Route
            path="/student"
            element={
              <ProtectedRoute allowedRole="student">
                <StudentDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRole="admin">
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/advisor"
            element={
              <ProtectedRoute allowedRole="advisor">
                <AdvisorDashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
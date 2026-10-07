import { useEffect, useState } from "react";
import { apiRequest } from "./api";

export default function App() {
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
    <main>
      <h1>Course Registration System</h1>
      <p>Application foundation</p>

      {connection.loading && (
        <p role="status">Checking API connection…</p>
      )}

      {connection.message && (
        <p role="status">{connection.message}</p>
      )}

      {connection.error && (
        <p role="alert">
          Could not connect to the API: {connection.error}
        </p>
      )}
    </main>
  );
}
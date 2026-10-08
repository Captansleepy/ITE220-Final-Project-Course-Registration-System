import app from "./app.js";
import connectDB from "./config/db.js";
import mongoose from "mongoose";

const port = Number(process.env.PORT || 5001);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(
    "PORT must be a whole number between 1 and 65535."
  );
}

try {
  await connectDB();

  const server = app.listen(port, () => {
    console.log(`API running at http://localhost:${port}`);
  });

  server.on("error", async (error) => {
    console.error(
      "Could not start the API:",
      error.code + " " + error.name
    );
    await mongoose.disconnect();
    process.exitCode = 1;
  });
} catch (error) {
  console.error(
    "Database startup failed. Check settings and Atlas access.",
    error.name
  );
  await mongoose.disconnect();
  process.exitCode = 1;
}
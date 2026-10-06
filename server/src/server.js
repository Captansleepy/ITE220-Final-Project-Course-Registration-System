import app from "./app.js";

const port = Number(process.env.PORT || 5001);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be a whole number between 1 and 65535.");
}

const server = app.listen(port, () => {
  console.log(`API running at http://localhost:${port}`);
});

server.on("error", (error) => {
  console.error("Could not start the API:", error.message);
  process.exit(1);
});
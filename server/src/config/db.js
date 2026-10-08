import mongoose from "mongoose";
import dns from "node:dns";

export default async function connectDB() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME;

  if (!uri || !dbName) {
    throw new Error(
      "MONGODB_URI and MONGODB_DB_NAME must be configured."
    );
  }

  // Optional DNS setting for networks that cannot resolve Atlas.
  if (process.env.DNS_SERVERS) {
    const servers = process.env.DNS_SERVERS
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    dns.setServers(servers);
  }

  await mongoose.connect(uri, {
    dbName,
    serverSelectionTimeoutMS: 10000,
    autoCreate: false,
    autoIndex: false,
  });

  console.log(`MongoDB connected: ${mongoose.connection.name}`);
}
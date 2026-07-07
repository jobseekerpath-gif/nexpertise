import { defineConfig } from "drizzle-kit";
import path from "path";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  out: path.join(__dirname, "./migrations"),
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  // `user_sessions` is created and owned at runtime by connect-pg-simple, not by
  // drizzle. Excluding it stops push from treating it as a drop and prompting a
  // (non-interactive-unsafe) create/rename resolver when new tables are added.
  tablesFilter: ["!user_sessions"],
});

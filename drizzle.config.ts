import { defineConfig } from "drizzle-kit";
import { resolveDatabaseUrl } from "./lib/database-url.mjs";

try {
  process.loadEnvFile();
} catch {
  // No .env file — rely on the real environment (CI, hosting provider).
}

export default defineConfig({
  out: "./drizzle",
  schema: "./db/schema.ts",
  dialect: "postgresql",
  dbCredentials: { url: resolveDatabaseUrl(process.env, { direct: true }) ?? "" },
  strict: true,
});

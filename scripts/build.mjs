/**
 * `npm run build`. On a Vercel *production* deploy, apply pending database
 * migrations first, so the schema always matches the code that goes live.
 * Preview deploys and local/CI builds never touch a database here.
 * If a migration fails the build fails, and the previous version stays live.
 */
import { spawnSync } from "node:child_process";
import { resolveDatabaseUrl } from "../lib/database-url.mjs";

const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

if (process.env.VERCEL_ENV === "production") {
  if (!resolveDatabaseUrl(process.env)) {
    console.error("DATABASE_URL is not set for production — connect the database before deploying.");
    process.exit(1);
  }
  console.log("Applying database migrations…");
  run("npx", ["drizzle-kit", "migrate"]);
}
run("npx", ["next", "build"]);

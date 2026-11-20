import { spawn } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";

/**
 * Runs pg_dump / pg_restore either from the local PATH or, with --docker,
 * inside the docker-compose `postgres` container (so the client version always
 * matches the server and nothing needs installing on Windows).
 */
export function runPgTool(tool: "pg_dump" | "pg_restore", args: string[], io: { stdoutFile?: string; stdinFile?: string } = {}): Promise<void> {
  const docker = process.argv.includes("--docker");
  const [cmd, fullArgs] = docker ? ["docker", ["compose", "exec", "-T", "postgres", tool, ...args]] : [tool, args];
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, fullArgs, { stdio: [io.stdinFile ? "pipe" : "ignore", io.stdoutFile ? "pipe" : "inherit", "inherit"] });
    if (io.stdinFile) createReadStream(io.stdinFile).pipe(child.stdin!);
    if (io.stdoutFile) child.stdout!.pipe(createWriteStream(io.stdoutFile));
    child.on("error", (e) => reject(new Error(`${cmd} could not start (${e.message}). Install PostgreSQL client tools or pass --docker.`)));
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${tool} exited with code ${code}`))));
  });
}

/** With --docker the tool runs inside the container, where the database is on localhost:5432. */
export function urlForTool(url: string): string {
  if (!process.argv.includes("--docker")) return url;
  const u = new URL(url);
  u.hostname = "localhost";
  u.port = "5432";
  return u.toString();
}

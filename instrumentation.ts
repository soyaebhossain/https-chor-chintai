/**
 * Runs once when the Next.js server starts. A missing or placeholder secret
 * must stop the server, not quietly fall back to a guessable default.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./lib/server/boot");
  }
}

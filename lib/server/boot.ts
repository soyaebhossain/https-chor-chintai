import "server-only";
import { getEnv } from "./env";

try {
  getEnv();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  console.error("Refusing to start. Copy .env.example to .env and fill in real values.");
  process.exit(1);
}

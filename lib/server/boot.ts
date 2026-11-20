import "server-only";
import { getEnv, productionGaps } from "./env";

try {
  const env = getEnv();
  for (const gap of productionGaps(env)) console.warn(`[config] ${gap}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  console.error("Refusing to start. Copy .env.example to .env and fill in real values.");
  process.exit(1);
}

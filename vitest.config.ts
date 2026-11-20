import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname),
      "server-only": path.resolve(import.meta.dirname, "tests/server-only-stub.ts"),
    },
  },
  test: {
    environment: "node",
    env: { PGLITE_DIR: "memory", DATABASE_URL: "" },
    testTimeout: 30_000,
  },
});

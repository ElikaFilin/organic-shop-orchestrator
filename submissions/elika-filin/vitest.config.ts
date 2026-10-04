import { defineConfig } from "vitest/config";

// One `pnpm test` runs every package's own vitest.config (node for the API, jsdom for the web app).
export default defineConfig({
  test: {
    projects: ["apps/*", "packages/*"],
  },
});

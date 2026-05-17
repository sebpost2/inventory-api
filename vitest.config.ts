import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    env: {
      TURSO_URL:        "file::memory:",
      TURSO_AUTH_TOKEN: "test-token",
      JWT_SECRET:       "test-secret-at-least-32-characters-long!!",
    },
    singleFork: true,
  },
})

import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["tests/marketBaseline.ts"],
    testTimeout: 180_000,
  },
})

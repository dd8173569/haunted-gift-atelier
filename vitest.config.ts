import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["lib/**/*.ts"],
      exclude: ["lib/**/*.d.ts"],
      reporter: ["text-summary", "json-summary"],
      reportsDirectory: "coverage",
      // REQ-REL-40: floor(measured) - 1, measured in M5 over the whole of lib/
      // (lines 99.02, statements 98.91, functions 100, branches 97.42).
      thresholds: { lines: 98, statements: 97, functions: 99, branches: 96 },
    },
  },
});

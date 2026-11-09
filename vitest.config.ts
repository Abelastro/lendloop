import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const report = process.env.TEST_REPORT === "1";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
    reporters: report ? ["default", "junit", "json"] : ["default"],
    outputFile: report
      ? {
          junit: "./reports/junit.xml",
          json: "./reports/vitest.json",
        }
      : undefined,
    coverage: {
      enabled: report,
      provider: "v8",
      reporter: ["text", "json-summary", "lcovonly"],
      reportsDirectory: "./reports/coverage",
      include: [
        "convex/**/*.ts",
        "lib/**/*.ts",
        "components/**/*.{ts,tsx}",
        "app/**/*.{ts,tsx}",
      ],
      exclude: ["**/_generated/**", "**/*.d.ts"],
    },
  },
});

import { defineConfig } from "vitest/config";

export default defineConfig({
  // vitest compiles JSX with oxc and ignores esbuild's JSX options. The
  // terminal interface renders through OpenTUI's React reconciler, so JSX
  // imports its runtime from there.
  oxc: { jsx: { runtime: "automatic", importSource: "@opentui/react" } },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/application/**", "src/lib/**"],
      exclude: ["**/*.test.{ts,tsx}"],
      thresholds: { 100: true },
    },
  },
});

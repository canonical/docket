import { defineConfig } from "vitest/config";

export default defineConfig({
  // vitest compiles JSX with oxc and ignores esbuild's JSX options. The
  // terminal interface renders through OpenTUI's React reconciler, so JSX
  // imports its runtime from there.
  oxc: { jsx: { runtime: "automatic", importSource: "@opentui/react" } },
  // OpenTUI ships one build for Bun and one for Node. Bun loads the Bun
  // build for the packages vitest leaves to it, so the files vitest reads
  // itself take the Bun build too: two copies of OpenTUI's classes would
  // not recognise each other's objects.
  ssr: { resolve: { conditions: ["bun"] } },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/application/**", "src/lib/**"],
      // The application's frame stories are exercised by the screens guarantee, not by the unit suite.
      exclude: ["**/*.test.{ts,tsx}", "src/application/**/*.stories.tsx"],
      thresholds: { 100: true },
    },
  },
});

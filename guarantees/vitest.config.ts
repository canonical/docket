import { defineConfig } from "vitest/config";

/**
 * The guarantees run under the runner the unit suite uses, so a failing
 * guarantee reads as a failing test. They measure no coverage: coverage
 * describes the code a suite sits beside, and the corpus sits beside
 * none of docket's.
 */
export default defineConfig({
  // `screens` draws the components' stories as the unit suite does: JSX
  // through OpenTUI's React runtime, and OpenTUI's Bun build throughout.
  oxc: { jsx: { runtime: "automatic", importSource: "@opentui/react" } },
  ssr: { resolve: { conditions: ["bun"] } },
  test: {
    root: import.meta.dirname,
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["fixtures/**", "goldens/**"],
    // Each entry starts docket as its own processes, one call at a time.
    fileParallelism: false,
    testTimeout: 60_000,
  },
});

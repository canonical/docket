import { createConfig } from "@aztlan/lago-config";
import { mergeConfig } from "vitest/config";
import { viewports } from "./src/testing/viewports.js";

// Lago's configuration: JSX through OpenTUI's React runtime, OpenTUI's Bun
// build throughout, the timers a component waits on faked, a unit project
// and a stories project drawn at the two screens every story is drawn at.
export default mergeConfig(createConfig({ viewports, coverage: true }), {
  // The repository's own gates are proven by their self-tests, run as
  // commands of their own, and are not the program.
  test: { coverage: { exclude: ["src/scripts/**"] } },
});

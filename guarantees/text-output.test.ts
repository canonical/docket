import { readFileSync } from "node:fs";
import { afterAll, describe, it } from "vitest";
import expectGolden from "./expectGolden.js";
import findFixture from "./findFixture.js";
import makeHome from "./makeHome.js";

/**
 * What `owed` and `activity` print, in each format, from the team's
 * recording at Monday 28 September 2026, 12:00 in Paris. A person reads
 * `plain`, an agent reads `llm`, and a program parses `json`, so a
 * change to any of them is a change a reader meets, and it shows here as
 * a diff to accept or refuse.
 */
const home = makeHome(readFileSync(findFixture("team.yaml"), "utf8"));
afterAll(() => home.remove());

const call = async (args: readonly string[]) => {
  const { code, out, err } = await home.call(args, {
    now: "2026-09-28T10:00:00Z",
    recording: "team",
  });
  return `exit ${code}\n--- out\n${out}--- err\n${err}`;
};

describe("text-output", () => {
  for (const command of ["owed", "activity"]) {
    for (const format of ["plain", "llm", "json"]) {
      it(`prints ${command} in ${format} as saved`, async () => {
        expectGolden(
          `text-output/${command}.${format}.txt`,
          await call([command, "--format", format]),
        );
      });
    }
  }
});

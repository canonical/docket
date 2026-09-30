import { describe, expect, it } from "vitest";
import { draw } from "../../../../testing/terminal.js";
import { tokens } from "../../../tokens/index.js";
import RefreshStages from "./RefreshStages.js";
import {
  BudgetPaused,
  Failed,
  RateLimited,
  Running,
} from "./RefreshStages.stories.js";

describe("RefreshStages", () => {
  it("draws each repository's short name, padded to the longest and one cell more, then its stage", async () => {
    const screen = await draw(<RefreshStages {...Running.args} />, 40);
    expect(screen.lines.slice(0, 3)).toEqual([
      "example ✓ 89 threads",
      "docs    reading page 2/3",
      "site    waiting",
    ]);
  });

  it("marks a repository done with ✓ in the success colour, its threads plain, and dims one waiting", async () => {
    const screen = await draw(<RefreshStages {...Running.args} />, 40);
    expect(screen.look("✓")?.fg).toBe(tokens["color.text.success"]);
    expect(screen.look("89 threads")?.fg).toBe(tokens["color.text"]);
    expect(screen.look("reading page")?.fg).toBe(tokens["color.text"]);
    expect(screen.look("waiting")?.fg).toBe(tokens["color.text.muted"]);
    expect(screen.look("example")?.fg).toBe(tokens["color.text"]);
  });

  it("dims the repositories the budget paused", async () => {
    const screen = await draw(<RefreshStages {...BudgetPaused.args} />, 40);
    expect(screen.lines.slice(1, 3)).toEqual([
      "docs    paused",
      "site    paused",
    ]);
    expect(screen.look("paused")?.fg).toBe(tokens["color.text.muted"]);
  });

  it("says why the rate limit paused the repositories, and counts one thread as one", async () => {
    const screen = await draw(<RefreshStages {...RateLimited.args} />, 40);
    expect(screen.lines.slice(0, 3)).toEqual([
      "example ✓ 1 thread",
      "docs    paused: rate limit",
      "site    paused: rate limit",
    ]);
  });

  it("wraps a failure's reason under the stage's column, in the error colour, at 40 and 60 columns", async () => {
    const narrow = await draw(<RefreshStages {...Failed.args} />, 40);
    expect(narrow.lines.slice(1, 4)).toEqual([
      "docs    ✗ failed: The provider failed",
      "        with GITHUB_TIMED_OUT",
      "site    waiting",
    ]);
    expect(narrow.look("✗ failed")?.fg).toBe(tokens["color.text.error"]);
    const wide = await draw(<RefreshStages {...Failed.args} width={60} />, 60);
    expect(wide.lines.at(1)).toBe(
      "docs    ✗ failed: The provider failed with GITHUB_TIMED_OUT",
    );
  });

  it("names a repository with no short name in full", async () => {
    const screen = await draw(
      <RefreshStages
        stages={[
          {
            repo: "example-org/other",
            stage: { kind: "checks", fetched: 0, total: 0 },
          },
        ]}
        names={{}}
        width={40}
      />,
      40,
    );
    expect(screen.lines.at(0)).toBe("example-org/other reading checks");
  });
});

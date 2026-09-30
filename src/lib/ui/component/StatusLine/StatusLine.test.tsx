import { describe, expect, it } from "vitest";
import { draw } from "../../../../testing/terminal.js";
import { tokens } from "../../../tokens/index.js";
import StatusLine from "./StatusLine.js";
import {
  ActionDone,
  ActionFailed,
  Blank,
  BudgetLow,
  BudgetLowWithDetails,
  BudgetPaused,
  DetailsLoading,
  FullRefresh,
  Idle,
  RateLimited,
  RefreshFailed,
  Refreshing,
  RefreshingWithDetails,
  Synced,
  Waking,
} from "./StatusLine.stories.js";

describe("StatusLine", () => {
  it("dims how old the data is at 40 columns", async () => {
    const screen = await draw(<StatusLine {...Synced.args} />, 40);
    expect(screen.lines.at(0)).toBe("synced 2m ago");
    expect(screen.look("synced")?.fg).toBe(tokens["color.text.muted"]);
  });

  it("draws an error with its ✗ in the error colour", async () => {
    const screen = await draw(<StatusLine {...RefreshFailed.args} />, 40);
    expect(screen.lines.at(0)).toBe("✗ refresh failed · data from 10:12");
    expect(screen.look("✗ refresh")?.fg).toBe(tokens["color.text.error"]);
  });

  it("draws a pause for the rate limit in the text colour, rows held or not", async () => {
    const held = await draw(<StatusLine {...RateLimited.args} />, 40);
    expect(held.lines.at(0)).toBe("paused: rate limit · resumes 14:20");
    expect(held.look("paused")?.fg).toBe(tokens["color.text"]);
    const { status } = RateLimited.args;
    const first = await draw(
      <StatusLine
        {...RateLimited.args}
        status={status && { ...status, syncedAt: undefined }}
      />,
      40,
    );
    expect(first.lines.at(0)).toBe("paused: rate limit · resumes 14:20");
    expect(first.look("paused")?.fg).toBe(tokens["color.text"]);
  });

  it("draws a refresh in progress in the text colour", async () => {
    const screen = await draw(<StatusLine {...Refreshing.args} />, 40);
    expect(screen.lines.at(0)).toBe("refreshing · docs 2/3");
    expect(screen.look("refreshing")?.fg).toBe(tokens["color.text"]);
  });

  it("cuts a message wider than the pane at 40 columns", async () => {
    const screen = await draw(<StatusLine {...FullRefresh.args} />, 40);
    expect(screen.lines.at(0)).toBe("full refresh · example 1/2 · pages 5/9");
    const narrow = await draw(
      <StatusLine {...FullRefresh.args} width={20} />,
      20,
    );
    expect(narrow.lines.at(0)).toBe("full refresh · exam…");
  });

  it("drops a full refresh's pages at 40 columns before it cuts a word, however many pages", async () => {
    const { status } = FullRefresh.args;
    for (const [fetched, total] of [
      [123, 456],
      [1234, 5678],
    ] as const) {
      const stages = [
        {
          repo: "example-org/example-repo",
          stage: { kind: "reading", fetched, total },
        },
        { repo: "example-org/example-docs", stage: { kind: "waiting" } },
      ] as const;
      const screen = await draw(
        <StatusLine
          {...FullRefresh.args}
          status={status && { ...status, stages }}
        />,
        40,
      );
      expect(screen.lines.at(0)).toBe("full refresh · example 1/2");
    }
  });

  it("shows the whole message at 60 columns", async () => {
    const screen = await draw(
      <StatusLine {...RateLimited.args} width={60} />,
      60,
    );
    expect(screen.lines.at(0)).toBe("paused: rate limit · resumes 14:20");
  });

  it("draws a failed action's result with its ✗ in the error colour", async () => {
    const screen = await draw(<StatusLine {...ActionFailed.args} />, 40);
    expect(screen.lines.at(0)).toBe("✗ could not open the browser");
    expect(screen.look("✗ could")?.fg).toBe(tokens["color.text.error"]);
  });

  it("draws an action's result with its ✓ in the success colour, each person it names behind their mark", async () => {
    const screen = await draw(<StatusLine {...ActionDone.args} />, 40);
    expect(screen.lines.at(0)).toBe("✓ assigned ◉ alice, ◐ erin");
    expect(screen.look("✓ assigned")?.fg).toBe(tokens["color.text.success"]);
    expect(screen.look("◉ alice")?.fg).toBe(tokens["color.text.team"]);
    expect(screen.look("◐ erin")?.fg).toBe(tokens["color.text.internal"]);
  });

  it("dims an idle pane's freshness and the key that wakes it, whole at 40 columns", async () => {
    const screen = await draw(<StatusLine {...Idle.args} />, 40);
    expect(screen.lines.at(0)).toBe("synced 25m ago · idle · any key wakes");
    expect(screen.look("idle")?.fg).toBe(tokens["color.text.muted"]);
  });

  it("leaves the count out where the two sides would meet", async () => {
    const screen = await draw(
      <StatusLine {...DetailsLoading.args} width={25} />,
      25,
    );
    expect(screen.lines.at(0)).toBe("synced 2m ago");
  });

  it("says what is left of the queries' budget on the right, dimmed, and when it resets", async () => {
    const screen = await draw(<StatusLine {...BudgetLow.args} />, 40);
    expect(screen.lines.at(0)).toBe(
      `synced 2m ago${" ".repeat(2)}budget 35% · resets 14:20`,
    );
    expect(screen.look("budget")?.fg).toBe(tokens["color.text.muted"]);
  });

  it("gives the right side to the details count while the budget is low", async () => {
    const screen = await draw(
      <StatusLine {...BudgetLowWithDetails.args} />,
      40,
    );
    expect(screen.lines.at(0)).toBe(
      `synced 2m ago${" ".repeat(15)}details 0/12`,
    );
  });

  it("leaves the right side empty below the budget floor", async () => {
    for (const width of [40, 60]) {
      const screen = await draw(
        <StatusLine {...BudgetPaused.args} width={width} />,
        width,
      );
      expect(screen.lines.at(0)).toBe("paused: budget low · resumes 13:00");
    }
  });

  it("counts the details read on the right, dimmed, beside how old the data is", async () => {
    const screen = await draw(<StatusLine {...DetailsLoading.args} />, 40);
    expect(screen.lines.at(0)).toBe(
      `synced 2m ago${" ".repeat(15)}details 0/12`,
    );
    expect(screen.look("details")?.fg).toBe(tokens["color.text.muted"]);
  });

  it("counts the details beside a background refresh, at 40 and 60 columns", async () => {
    const narrow = await draw(
      <StatusLine {...RefreshingWithDetails.args} />,
      40,
    );
    expect(narrow.lines.at(0)).toBe(
      `refreshing · docs 2/3${" ".repeat(7)}details 3/12`,
    );
    const wide = await draw(
      <StatusLine {...RefreshingWithDetails.args} width={60} />,
      60,
    );
    expect(wide.lines.at(0)).toBe(
      `refreshing · docs 2/3${" ".repeat(27)}details 3/12`,
    );
  });

  it("counts the whole window's details on waking", async () => {
    const screen = await draw(<StatusLine {...Waking.args} />, 40);
    expect(screen.lines.at(0)).toBe(
      `refreshing · example 1/3${" ".repeat(4)}details 0/12`,
    );
  });

  it("drops the count first when the two sides would meet", async () => {
    const screen = await draw(
      <StatusLine {...RefreshingWithDetails.args} width={32} />,
      32,
    );
    expect(screen.lines.at(0)).toBe("refreshing · docs 2/3");
  });

  it("stays blank with no cache", async () => {
    const screen = await draw(<StatusLine {...Blank.args} />, 40);
    expect(screen.lines.at(0)).toBe("");
  });
});

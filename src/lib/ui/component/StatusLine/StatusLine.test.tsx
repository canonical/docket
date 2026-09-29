import { describe, expect, it } from "vitest";
import { draw } from "../../../../testing/terminal.js";
import { tokens } from "../../../tokens/index.js";
import StatusLine from "./StatusLine.js";
import {
  ActionDone,
  ActionFailed,
  Blank,
  BudgetPaused,
  DetailsPaused,
  FullRefresh,
  Idle,
  RateLimited,
  Refreshing,
  Synced,
} from "./StatusLine.stories.js";

describe("StatusLine", () => {
  it("dims how old the data is at 40 columns", async () => {
    const screen = await draw(<StatusLine {...Synced.args} />, 40);
    expect(screen.lines.at(0)).toBe("synced 2m ago");
    expect(screen.look("synced")?.fg).toBe(tokens["color.text.muted"]);
  });

  it("draws an error with its ✗ in the error colour", async () => {
    const screen = await draw(<StatusLine {...RateLimited.args} />, 40);
    expect(screen.lines.at(0)).toBe("✗ rate limited · resumes 14:20");
    expect(screen.look("✗ rate")?.fg).toBe(tokens["color.text.error"]);
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

  it("shows the whole message at 60 columns", async () => {
    const screen = await draw(
      <StatusLine {...RateLimited.args} width={60} />,
      60,
    );
    expect(screen.lines.at(0)).toBe("✗ rate limited · resumes 14:20");
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

  it("dims details paused on the right side, apart from how old the data is", async () => {
    const screen = await draw(<StatusLine {...DetailsPaused.args} />, 40);
    expect(screen.lines.at(0)).toBe(
      `synced 2m ago${" ".repeat(13)}details paused`,
    );
    expect(screen.look("details")?.fg).toBe(tokens["color.text.muted"]);
  });

  it("leaves details paused out where the two sides would meet", async () => {
    const screen = await draw(
      <StatusLine {...DetailsPaused.args} width={27} />,
      27,
    );
    expect(screen.lines.at(0)).toBe("synced 2m ago");
  });

  it("leaves the right side empty below the budget floor", async () => {
    for (const width of [40, 60]) {
      const screen = await draw(
        <StatusLine {...BudgetPaused.args} width={width} />,
        width,
      );
      expect(screen.lines.at(0)).toBe("refresh paused · resumes 13:00");
    }
  });

  it("hides details paused while the left side shows an error or the pane is idle", async () => {
    const limited = await draw(
      <StatusLine {...RateLimited.args} detailsPaused />,
      40,
    );
    expect(limited.lines.at(0)).toBe("✗ rate limited · resumes 14:20");
    const idle = await draw(<StatusLine {...Idle.args} detailsPaused />, 40);
    expect(idle.lines.at(0)).toBe("synced 25m ago · idle · any key wakes");
  });

  it("stays blank with no cache", async () => {
    const screen = await draw(<StatusLine {...Blank.args} />, 40);
    expect(screen.lines.at(0)).toBe("");
  });
});

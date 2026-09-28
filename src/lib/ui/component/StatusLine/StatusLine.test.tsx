import { describe, expect, it } from "vitest";
import { draw } from "../../../../testing/terminal.js";
import { tokens } from "../../../tokens/index.js";
import StatusLine from "./StatusLine.js";
import {
  ActionDone,
  ActionFailed,
  Blank,
  FullRefresh,
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
    expect(screen.lines.at(0)).toBe("refreshing…");
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

  it("draws an action's result with its ✓ in the success colour", async () => {
    const screen = await draw(<StatusLine {...ActionDone.args} />, 40);
    expect(screen.lines.at(0)).toBe("✓ assigned alice");
    expect(screen.look("✓ assigned")?.fg).toBe(tokens["color.text.success"]);
  });

  it("stays blank with no cache", async () => {
    const screen = await draw(<StatusLine {...Blank.args} />, 40);
    expect(screen.lines.at(0)).toBe("");
  });
});

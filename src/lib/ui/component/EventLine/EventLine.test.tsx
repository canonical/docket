import { describe, expect, it } from "vitest";
import { draw } from "../../../../testing/terminal.js";
import { tokens } from "../../../tokens/index.js";
import EventLine from "./EventLine.js";
import { Bot, ChecksFailed, Pushed } from "./EventLine.stories.js";

describe("EventLine", () => {
  it("says who did what under its thread, the stack mark running on beside it, with the age at the right edge at 40 columns", async () => {
    const screen = await draw(<EventLine {...Pushed.args} />, 40);
    expect(screen.lines.at(0)).toBe(" ┆  alice pushed 2 commits           25m");
    expect(screen.look("alice pushed")).toMatchObject({
      fg: tokens["color.text"],
      bold: false,
    });
  });

  it("keeps the age at the right edge of a wider pane", async () => {
    const screen = await draw(<EventLine {...Pushed.args} width={60} />, 60);
    expect(screen.lines.at(0)).toBe(
      ` ┆  alice pushed 2 commits${" ".repeat(31)}25m`,
    );
  });

  it("marks failed checks with ✗ and draws the whole line, age included, in the error colour", async () => {
    const screen = await draw(<EventLine {...ChecksFailed.args} />, 40);
    expect(screen.lines.at(0)).toBe(" ┆  ✗ checks failed (lint)           20m");
    expect(screen.look("✗ checks failed")?.fg).toBe(tokens["color.text.error"]);
    expect(screen.look("20m")?.fg).toBe(tokens["color.text.error"]);
  });

  it("dims a bot's event, age included", async () => {
    const screen = await draw(<EventLine {...Bot.args} />, 40);
    expect(screen.lines.at(0)).toBe("    example-sync opened               3h");
    expect(screen.look("example-sync opened")?.fg).toBe(
      tokens["color.text.muted"],
    );
  });

  it("cuts the event with an ellipsis before the age gives way", async () => {
    const screen = await draw(<EventLine {...Pushed.args} width={20} />, 20);
    expect(screen.lines.at(0)).toBe(" ┆  alice pushe… 25m");
  });
});

import { describe, expect, it } from "vitest";
import { draw } from "../../../../testing/terminal.js";
import { tokens } from "../../../tokens/index.js";
import EventLine from "./EventLine.js";
import {
  Bot,
  ChecksFailed,
  EndingOver,
  EndingWithin,
  Pushed,
} from "./EventLine.stories.js";

describe("EventLine", () => {
  it("says who did what under its thread, the actor behind their mark, the stack mark running on beside it, with the age at the right edge at 40 columns", async () => {
    const screen = await draw(<EventLine {...Pushed.args} />, 40);
    expect(screen.lines.at(0)).toBe(
      ` ┆  ● alice pushed 2 commits${" ".repeat(9)}25m`,
    );
    expect(screen.look("● alice")?.fg).toBe(tokens["color.text.team"]);
    expect(screen.look(" pushed 2 commits")).toMatchObject({
      fg: tokens["color.text"],
      bold: false,
    });
  });

  it("keeps the age at the right edge of a wider pane", async () => {
    const screen = await draw(<EventLine {...Pushed.args} width={60} />, 60);
    expect(screen.lines.at(0)).toBe(
      ` ┆  ● alice pushed 2 commits${" ".repeat(29)}25m`,
    );
  });

  it("marks failed checks with ✗ in the error colour, the age plain", async () => {
    const screen = await draw(<EventLine {...ChecksFailed.args} />, 40);
    expect(screen.lines.at(0)).toBe(" ┆  ✗ checks failed (lint)           20m");
    expect(screen.look("✗ checks failed")?.fg).toBe(tokens["color.text.error"]);
    expect(screen.look("20m")?.fg).toBe(tokens["color.text"]);
  });

  it("dims a bot's event behind its mark, age included", async () => {
    const screen = await draw(<EventLine {...Bot.args} />, 40);
    expect(screen.lines.at(0)).toBe(
      `${" ".repeat(4)}■ example-sync opened${" ".repeat(13)}3h`,
    );
    expect(screen.look("■ example-sync")?.fg).toBe(tokens["color.text.muted"]);
    expect(screen.look(" opened")?.fg).toBe(tokens["color.text.muted"]);
    expect(screen.look("3h")?.fg).toBe(tokens["color.text.muted"]);
  });

  it("ends a finished thread's heavy red bar on its ending, past its target", async () => {
    const screen = await draw(<EventLine {...EndingOver.args} />, 40);
    expect(screen.lines.at(0)).toBe("╹   ◉ alice closed as not planned     2d");
    expect(screen.look("╹")?.fg).toBe(tokens["color.text.error"]);
    expect(screen.look(" closed as not planned")?.fg).toBe(
      tokens["color.text"],
    );
  });

  it("ends a finished thread's light green bar on its ending, within its target, beside the stack mark", async () => {
    const screen = await draw(<EventLine {...EndingWithin.args} />, 40);
    expect(screen.lines.at(0)).toBe("╵┆  ● bob merged                     20h");
    expect(screen.look("╵")?.fg).toBe(tokens["color.text.success"]);
  });

  it("dims an ending a bot made, as activity dims a bot's event", async () => {
    const { line } = EndingWithin.args;
    const bot = {
      ...line,
      actor: { text: "example-sync", fit: "trimmed", group: "bot" },
    } as const;
    const screen = await draw(
      <EventLine {...EndingWithin.args} line={bot} />,
      40,
    );
    expect(screen.look(" merged")?.fg).toBe(tokens["color.text.muted"]);
    expect(screen.look("20h")?.fg).toBe(tokens["color.text.muted"]);
  });

  it("draws what happened alone when no actor is named", async () => {
    const { actor: _, ...line } = Pushed.args.line;
    const screen = await draw(<EventLine {...Pushed.args} line={line} />, 40);
    expect(screen.lines.at(0)).toBe(` ┆  pushed 2 commits${" ".repeat(17)}25m`);
  });

  it("cuts the event with an ellipsis before the age gives way", async () => {
    const screen = await draw(<EventLine {...Pushed.args} width={20} />, 20);
    expect(screen.lines.at(0)).toBe(" ┆  ● alice pus… 25m");
  });
});

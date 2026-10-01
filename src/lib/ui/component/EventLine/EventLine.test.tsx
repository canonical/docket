import { describe, expect, it } from "vitest";
import { draw } from "../../../../testing/terminal.js";
import { tokens } from "../../../tokens/index.js";
import EventLine from "./EventLine.js";
import { Bot, ChecksFailed, Long, Pushed } from "./EventLine.stories.js";

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

  it("keeps the actor, its login cut at 12 cells, then cuts the words before the target, then the target", async () => {
    const at = async (width: number) =>
      (await draw(<EventLine {...Long.args} width={width} />, width)).lines.at(
        0,
      );
    const actor = " ┆  ○ example-con…";
    const target = "priority: needs-a-decision-from-the-maintainers";
    expect(await at(78)).toBe(`${actor} labelled ${target} 3h`);
    expect(await at(77)).toBe(`${actor} labell… ${target} 3h`);
    expect(await at(74)).toBe(`${actor} lab… ${target} 3h`);
    expect(await at(73)).toBe(
      `${actor} lab… priority: needs-a-deci…on-from-the-maintainers 3h`,
    );
    expect(await at(40)).toBe(`${actor} lab… priori…ainers 3h`);
  });

  it("draws a person the event assigned behind their mark, in their group's hue", async () => {
    const line = {
      ...Pushed.args.line,
      action: { text: "assigned bob", kind: "words" as const },
      target: {
        text: "bob",
        kind: "person" as const,
        group: "team" as const,
      },
    };
    const screen = await draw(<EventLine {...Pushed.args} line={line} />, 40);
    expect(screen.lines.at(0)).toMatch(/^ ┆ {2}● alice assigned ● bob +25m$/);
    expect(screen.look("● bob")?.fg).toBe(tokens["color.text.team"]);
  });

  it("cuts the words of failed checks before their names, keeping the brackets", async () => {
    const line = {
      ...ChecksFailed.args.line,
      action: {
        text: "checks failed (lint the whole repository, unit tests)",
        kind: "words" as const,
      },
      target: {
        text: "lint the whole repository, unit tests",
        kind: "identifier" as const,
      },
    };
    const screen = await draw(
      <EventLine {...ChecksFailed.args} line={line} />,
      40,
    );
    expect(screen.lines.at(0)).toBe(" ┆  ✗ che… (lint the wh… unit tests) 20m");
  });

  it("draws what happened alone when no actor is named", async () => {
    const { actor: _, ...line } = Pushed.args.line;
    const screen = await draw(<EventLine {...Pushed.args} line={line} />, 40);
    expect(screen.lines.at(0)).toBe(` ┆  pushed 2 commits${" ".repeat(17)}25m`);
  });

  it("keeps the actor and cuts what was done in its middle, before the age gives way", async () => {
    const screen = await draw(<EventLine {...Pushed.args} width={20} />, 20);
    expect(screen.lines.at(0)).toBe(" ┆  ● alice p…ts 25m");
  });
});

import { describe, expect, it } from "vitest";
import { findEventLine } from "../../../../testing/activity.js";
import { findFinishedRow } from "../../../../testing/finished.js";
import { draw, hex } from "../../../../testing/terminal.js";
import { tokens } from "../../../tokens/index.js";
import EventLine from "./EventLine.js";
import {
  Bot,
  ChecksFailed,
  EndingOver,
  EndingWithin,
  Long,
  Pushed,
} from "./EventLine.stories.js";
import type { EventLineProps } from "./types.js";

describe("EventLine", () => {
  it("says who did what under its thread, the actor behind their mark, the stack mark running on beside it, with the age at the right edge at 40 columns", async () => {
    const screen = await draw(<EventLine {...Pushed.args} />, 40);
    expect(screen.lines.at(0)).toBe(
      ` ┆  ● alice pushed 2 commits${" ".repeat(9)}25m`,
    );
    expect(screen.look("● alice")?.fg).toBe(hex(tokens["color.text.team"]));
    expect(screen.look(" pushed 2 commits")).toMatchObject({
      fg: hex(tokens["color.text"]),
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
    expect(screen.look("✗ checks failed")?.fg).toBe(
      hex(tokens["color.text.error"]),
    );
    expect(screen.look("20m")?.fg).toBe(hex(tokens["color.text"]));
  });

  it("dims a bot's event behind its mark, age included", async () => {
    const screen = await draw(<EventLine {...Bot.args} />, 40);
    expect(screen.lines.at(0)).toBe(
      `${" ".repeat(4)}■ example-sync opened${" ".repeat(13)}3h`,
    );
    expect(screen.look("■ example-sync")?.fg).toBe(
      hex(tokens["color.text.muted"]),
    );
    expect(screen.look(" opened")?.fg).toBe(hex(tokens["color.text.muted"]));
    expect(screen.look("3h")?.fg).toBe(hex(tokens["color.text.muted"]));
  });

  it("ends a finished thread's heavy red bar on its ending, past its target", async () => {
    const screen = await draw(<EventLine {...EndingOver.args} />, 40);
    expect(screen.lines.at(0)).toBe("╹   ◉ alice closed as not planned     2d");
    expect(screen.look("╹")?.fg).toBe(hex(tokens["color.text.error"]));
    expect(screen.look(" closed as not planned")?.fg).toBe(
      hex(tokens["color.text"]),
    );
  });

  it("ends a finished thread's light green bar on its ending, within its target, beside the stack mark", async () => {
    const screen = await draw(<EventLine {...EndingWithin.args} />, 40);
    expect(screen.lines.at(0)).toBe("╵┆  ● bob merged                     20h");
    expect(screen.look("╵")?.fg).toBe(hex(tokens["color.text.success"]));
  });

  it("dims an ending a bot made, as activity dims a bot's event", async () => {
    const bot = {
      ...findFinishedRow("example#2").ending,
      actor: { text: "example-sync", kind: "person", group: "bot" },
    } as const;
    const screen = await draw(
      <EventLine line={bot} state="within" stacked width={40} />,
      40,
    );
    expect(screen.look(" merged")?.fg).toBe(hex(tokens["color.text.muted"]));
    expect(screen.look("20h")?.fg).toBe(hex(tokens["color.text.muted"]));
  });

  it("takes a verdict for a finished thread's ending alone, never an activity event", async () => {
    // @ts-expect-error an activity event carries no verdict.
    const props: EventLineProps = {
      line: findEventLine(12, 1),
      stacked: true,
      width: 40,
      state: "over",
    };
    expect(props.state).toBe("over");
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

  it("measures what was done as it is drawn, without the format characters it holds", async () => {
    const { line } = Long.args;
    const hide = (text: string) =>
      text.replace("priority", "\u202e\u2066prio\u2069rity");
    const hidden = {
      ...line,
      action: { ...line.action, text: hide(line.action.text) },
      target: line.target && { ...line.target, text: hide(line.target.text) },
    };
    const screen = await draw(
      <EventLine {...Long.args} line={hidden} width={78} />,
      78,
    );
    expect(screen.lines.at(0)).toContain(" labelled priority:");
  });

  it("counts the bracket closing failed checks' names when it cuts the words before them", async () => {
    const { line } = ChecksFailed.args;
    const name = "build-the-documentation-site";
    const failed = {
      ...line,
      action: { ...line.action, text: `checks failed (${name})` },
      target: line.target && { ...line.target, text: name },
    };
    const at = async (width: number) =>
      (
        await draw(
          <EventLine {...ChecksFailed.args} line={failed} width={width} />,
          width,
        )
      ).lines.at(0);
    expect(await at(54)).toBe(` ┆  ✗ checks failed (${name}) 20m`);
    expect(await at(53)).toBe(` ┆  ✗ checks fail… (${name}) 20m`);
  });

  it("keeps the bracket closing failed checks' names whole, though a name ends in an escape", async () => {
    const { line } = ChecksFailed.args;
    const names = "lint, unit\u001b";
    const failed = {
      ...line,
      action: { ...line.action, text: `checks failed (${names})` },
      target: line.target && { ...line.target, text: names },
    };
    const screen = await draw(
      <EventLine {...ChecksFailed.args} line={failed} />,
      40,
    );
    expect(screen.lines.at(0)).toContain("✗ checks failed (lint, unit) ");
  });

  it("splits what was done about the last place the target is named, though the words name it too", async () => {
    const line = {
      ...Pushed.args.line,
      action: { text: "labelled led", kind: "words" as const },
      target: { text: "led", kind: "words" as const },
    };
    const screen = await draw(
      <EventLine {...Pushed.args} line={line} width={26} />,
      26,
    );
    expect(screen.lines.at(0)).toBe(" ┆  ● alice label… led 25m");
  });

  it("names the person an event assigned plainly, after the actor's mark", async () => {
    const line = {
      ...Pushed.args.line,
      action: { text: "assigned bob", kind: "words" as const },
      target: { text: "bob", kind: "person" as const },
    };
    const screen = await draw(<EventLine {...Pushed.args} line={line} />, 40);
    expect(screen.lines.at(0)).toMatch(/^ ┆ {2}● alice assigned bob +25m$/);
    expect(screen.look("bob")?.fg).toBe(hex(tokens["color.text"]));
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
    const { actor: _, ...line } = findEventLine(12, 1);
    const screen = await draw(<EventLine line={line} stacked width={40} />, 40);
    expect(screen.lines.at(0)).toBe(` ┆  pushed 2 commits${" ".repeat(17)}25m`);
  });

  it("keeps the actor and cuts what was done in its middle, before the age gives way", async () => {
    const screen = await draw(<EventLine {...Pushed.args} width={20} />, 20);
    expect(screen.lines.at(0)).toBe(" ┆  ● alice p…ts 25m");
  });
});

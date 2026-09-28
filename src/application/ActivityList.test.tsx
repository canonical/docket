import { describe, expect, it } from "vitest";
import { tokens } from "../lib/tokens/index.js";
import { recordedActivity } from "../testing/recorded.js";
import { draw } from "../testing/terminal.js";
import ActivityList from "./ActivityList.js";

describe("ActivityList", () => {
  it("heads each kind of thread, with every thread's events nested under it, at 40 columns", async () => {
    const screen = await draw(
      <ActivityList list={recordedActivity("kind")} width={40} />,
      40,
    );
    expect(screen.lines.slice(0, 12)).toEqual([
      "ISSUES",
      "  docs#4 issue                       16h",
      "  Where do tokens live?",
      "  alice, bob",
      "    example-sync labelled kind=docs  16h",
      "PULL REQUESTS",
      " ┃example#12 PR                      25m",
      " ┃Fix the parser · alice",
      "    ✗ checks failed (lint)           25m",
      "    alice requested review            3h",
      "    dave commented                    3d",
      "",
    ]);
    expect(screen.look("PULL REQUESTS")?.bold).toBe(true);
  });

  it("lists the threads without headings when not grouped, at 60 columns", async () => {
    const screen = await draw(
      <ActivityList list={recordedActivity("none")} width={60} />,
      60,
    );
    expect(screen.lines.slice(0, 3)).toEqual([
      ` ┃example#12 PR${" ".repeat(42)}25m`,
      " ┃Fix the parser · alice",
      `    ✗ checks failed (lint)${" ".repeat(31)}25m`,
    ]);
    expect(screen.look("✗ checks failed")?.fg).toBe(tokens["color.text.error"]);
  });
});

import { describe, expect, it } from "vitest";
import { thread } from "../../../../testing/facts.js";
import { measureRow } from "../../../../testing/rows.js";
import { draw } from "../../../../testing/terminal.js";
import { tokens } from "../../../tokens/index.js";
import ThreadRow from "./ThreadRow.js";
import {
  ActivityDraft,
  ActivityInvalidFile,
  ActivityStacked,
  ActivityTwoOwners,
  DraftClose,
  OverReviewSelected,
  SharedClose,
  SoonReply,
} from "./ThreadRow.stories.js";

describe("ThreadRow", () => {
  describe("at 40 columns", () => {
    it("draws a review over its target on two lines, the distance right-aligned", async () => {
      const screen = await draw(<ThreadRow {...OverReviewSelected.args} />, 40);
      expect(screen.lines.slice(0, 3)).toEqual([
        `▌┃example#12 review${" ".repeat(14)}1d over`,
        " ┃Fix the parser · bob ✗ checks",
        "",
      ]);
    });

    it("gives the state's colour to the distance and a failing field the error colour", async () => {
      const screen = await draw(<ThreadRow {...OverReviewSelected.args} />, 40);
      expect(screen.look("1d over")?.fg).toBe(tokens["color.text.error"]);
      expect(screen.look("✗ checks")?.fg).toBe(tokens["color.text.error"]);
      expect(screen.look("example#12")?.fg).toBe(tokens["color.text"]);
    });

    it("gives both lines of the selected row the selection background, and no other", async () => {
      const selected = await draw(
        <ThreadRow {...OverReviewSelected.args} />,
        40,
      );
      expect(selected.look("example#12")?.bg).toBe(
        tokens["color.background.selected"],
      );
      expect(selected.look("Fix the parser")?.bg).toBe(
        tokens["color.background.selected"],
      );
      const resting = await draw(
        <ThreadRow {...OverReviewSelected.args} selected={false} />,
        40,
      );
      expect(resting.look("Fix the parser")?.bg).not.toBe(
        tokens["color.background.selected"],
      );
    });

    it("draws a draft's close on track, the word draft dimmed after the owner", async () => {
      const screen = await draw(<ThreadRow {...DraftClose.args} />, 40);
      expect(screen.lines.slice(0, 2)).toEqual([
        `▌┃example#13 close${" ".repeat(15)}8d left`,
        " ┃Document the parser · alice draft",
      ]);
      expect(screen.look("8d left")?.fg).toBe(tokens["color.text"]);
      expect(screen.look("draft")?.fg).toBe(tokens["color.text.muted"]);
    });

    it("names every owner on a third line, each login cut at 12 cells", async () => {
      const screen = await draw(<ThreadRow {...SharedClose.args} />, 40);
      expect(screen.lines.slice(0, 4)).toEqual([
        `▌ example#4 close${" ".repeat(16)}5d over`,
        "  Where do tokens live?",
        "  alice, bob, carol-at-ex…",
        "",
      ]);
    });

    it("draws GitHub's title without its escape sequences", async () => {
      const row = measureRow({
        thread: thread({ title: "Fix\u001b[2J the\u0007 parser" }),
      });
      const screen = await draw(<ThreadRow row={row} width={40} />, 40);
      expect(screen.lines.at(1)).toBe("  Fix the parser · unassigned");
    });
  });

  describe("wider than 40 columns", () => {
    it("stretches the line so the distance stays at the right edge", async () => {
      const screen = await draw(
        <ThreadRow {...SoonReply.args} width={60} />,
        60,
      );
      expect(screen.lines.slice(0, 2)).toEqual([
        `▌ example#15 reply${" ".repeat(35)}3h left`,
        "  Crash on start · unassigned",
      ]);
      expect(screen.look("3h left")?.fg).toBe(tokens["color.text.warning"]);
    });

    it("marks a row whose repository file is invalid, as a field in trouble", async () => {
      const row = measureRow({}, true);
      const screen = await draw(<ThreadRow row={row} width={60} />, 60);
      expect(screen.lines.at(1)).toBe(
        "  Example thread · unassigned ✗ invalid repository file",
      );
      expect(screen.look("✗ invalid")?.fg).toBe(tokens["color.text.error"]);
    });
  });

  describe("narrower than its text", () => {
    it("cuts the title first, so the owner and a failing field stay whole", async () => {
      const screen = await draw(
        <ThreadRow {...OverReviewSelected.args} width={24} />,
        24,
      );
      expect(screen.lines.slice(0, 2)).toEqual([
        "▌┃example#12 re… 1d over",
        " ┃Fix th… · bob ✗ checks",
      ]);
    });

    it("cuts the marks too when even they do not fit", async () => {
      const row = measureRow({ owners: ["alice"] }, true);
      const screen = await draw(<ThreadRow row={row} width={24} />, 24);
      expect(screen.lines.at(1)).toBe("   · alice ✗ invalid re…");
    });
  });

  describe("in activity", () => {
    it("names the thread and its newest event's age in the plain text colour, with no state marker", async () => {
      const screen = await draw(<ThreadRow {...ActivityStacked.args} />, 40);
      expect(screen.lines.slice(0, 3)).toEqual([
        " ┃example#12 PR                      20m",
        " ┃Fix the parser · alice",
        "",
      ]);
      expect(screen.look("20m")?.fg).toBe(tokens["color.text"]);
      expect(screen.look("┃")?.fg).toBe(tokens["color.text.muted"]);
    });

    it("keeps the age at the right edge of a wider pane, the word draft dimmed", async () => {
      const screen = await draw(
        <ThreadRow {...ActivityDraft.args} width={60} />,
        60,
      );
      expect(screen.lines.slice(0, 2)).toEqual([
        `  example#14 PR${" ".repeat(43)}3h`,
        "  Update dependency example-lib to 2.0 · unassigned draft",
      ]);
      expect(screen.look("draft")?.fg).toBe(tokens["color.text.muted"]);
    });

    it("cuts the title first, so the owner and the word draft stay whole", async () => {
      const screen = await draw(<ThreadRow {...ActivityDraft.args} />, 40);
      expect(screen.lines.at(1)).toBe(
        "  Update dependency … · unassigned draft",
      );
    });

    it("lists two owners on a third line", async () => {
      const screen = await draw(<ThreadRow {...ActivityTwoOwners.args} />, 40);
      expect(screen.lines.slice(0, 4)).toEqual([
        "  example#15 issue                    1d",
        "  Crash on start",
        "  alice, bob",
        "",
      ]);
    });

    it("marks a repository's invalid file with ✗ in the error colour", async () => {
      const screen = await draw(
        <ThreadRow {...ActivityInvalidFile.args} />,
        40,
      );
      expect(screen.lines.at(1)).toBe(
        "  Where… · bob ✗ invalid repository file",
      );
      expect(screen.look("✗ invalid")?.fg).toBe(tokens["color.text.error"]);
    });

    it("caps a long login at 12 cells", async () => {
      const row = {
        ...ActivityStacked.args.row,
        owner: { text: "example-maintainer", fit: "trimmed" as const },
      };
      const screen = await draw(<ThreadRow row={row} width={40} />, 40);
      expect(screen.lines.at(1)).toBe(" ┃Fix the parser · example-mai…");
    });
  });
});

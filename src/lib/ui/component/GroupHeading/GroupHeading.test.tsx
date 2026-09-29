import { describe, expect, it } from "vitest";
import { draw } from "../../../../testing/terminal.js";
import { tokens } from "../../../tokens/index.js";
import GroupHeading from "./GroupHeading.js";
import { NotInAStack, Owner, Stack } from "./GroupHeading.stories.js";

describe("GroupHeading", () => {
  it("names a stack, then a rule to the pane's edge, neither of them bold, at 40 columns", async () => {
    const screen = await draw(<GroupHeading {...Stack.args} />, 40);
    expect(screen.lines.at(0)).toBe(
      `example stack 3 · 3 PRs → main ${"─".repeat(9)}`,
    );
    expect(screen.look("example stack 3")).toMatchObject({
      fg: tokens["color.text"],
      bold: false,
    });
    expect(screen.look("─")?.bold).toBe(false);
  });

  it("keeps a person's mark and hue in their section's heading", async () => {
    const screen = await draw(<GroupHeading {...Owner.args} />, 40);
    expect(screen.lines.at(0)).toBe(`◉ alice ${"─".repeat(32)}`);
    expect(screen.look("◉ alice")?.fg).toBe(tokens["color.text.team"]);
  });

  it("draws the rule to the edge of a wider pane", async () => {
    const screen = await draw(
      <GroupHeading {...NotInAStack.args} width={60} />,
      60,
    );
    expect(screen.lines.at(0)).toBe(`NOT IN A STACK ${"─".repeat(45)}`);
  });

  it("cuts a name wider than the pane with an ellipsis, leaving room for the rule", async () => {
    const stack = await draw(<GroupHeading {...Stack.args} width={16} />, 16);
    expect(stack.lines.slice(0, 2)).toEqual(["example stack… ─", ""]);
    const owner = await draw(<GroupHeading {...Owner.args} width={8} />, 8);
    expect(owner.lines.at(0)).toBe("◉ ali… ─");
  });
});

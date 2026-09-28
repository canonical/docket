import { describe, expect, it } from "vitest";
import { draw } from "../../../../testing/terminal.js";
import { tokens } from "../../../tokens/index.js";
import GroupHeading from "./GroupHeading.js";
import { NotInAStack, Owner, Stack } from "./GroupHeading.stories.js";

describe("GroupHeading", () => {
  it("names a stack in bold text at 40 columns", async () => {
    const screen = await draw(<GroupHeading {...Stack.args} />, 40);
    expect(screen.lines.at(0)).toBe("example stack 3 · 3 PRs → main");
    expect(screen.look("example stack 3")).toMatchObject({
      fg: tokens["color.text"],
      bold: true,
    });
  });

  it("names an owner and the stackless section whole at 60 columns", async () => {
    const owner = await draw(<GroupHeading {...Owner.args} width={60} />, 60);
    expect(owner.lines.at(0)).toBe("alice");
    const rest = await draw(
      <GroupHeading {...NotInAStack.args} width={60} />,
      60,
    );
    expect(rest.lines.at(0)).toBe("NOT IN A STACK");
  });

  it("cuts a heading wider than the pane with an ellipsis, on one line", async () => {
    const screen = await draw(<GroupHeading {...Stack.args} width={16} />, 16);
    expect(screen.lines.slice(0, 2)).toEqual(["example stack 3…", ""]);
  });
});

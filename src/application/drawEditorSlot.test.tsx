import { describe, expect, it } from "vitest";
import { draw } from "../testing/terminal.js";
import drawEditorSlot from "./drawEditorSlot.js";

const refusal = {
  reason: "a review is requested on a pull request, not on an issue",
  recovery: "select a pull request, then press r",
};

describe("drawEditorSlot", () => {
  it("stands nothing in the accordion's place while no editor is open or refused", () => {
    expect(drawEditorSlot({}, 40)).toEqual({});
  });

  it("stands the refusal in the accordion's place, as tall as its wrapped lines, and alone for a list with no row", async () => {
    const { refused, slot } = drawEditorSlot({ refusal }, 40);
    const screen = await draw(<box>{refused}</box>, 40, 6);
    const drawn = screen.lines.filter((line) => line !== "").length;
    expect(slot?.lines).toBe(drawn);
    expect(slot?.node).toBe(refused);
  });

  it("stands the open picker in the accordion's place, as tall as its lines", async () => {
    const picker = { filter: "", onFilter: () => {}, cursor: 0 };
    const { refused, slot } = drawEditorSlot({ picker }, 40);
    const screen = await draw(<box>{slot?.node}</box>, 40, 6);
    expect(slot?.lines).toBe(screen.lines.filter((line) => line !== "").length);
    expect(refused).toBeUndefined();
  });
});

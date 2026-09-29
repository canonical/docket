import { useState } from "react";
import { describe, expect, it } from "vitest";
import { draw } from "../testing/terminal.js";
import type { TerminalMode } from "./types.js";
import useShownList, { type UseShownListResult } from "./useShownList.js";

let shown: UseShownListResult | undefined;
let switchMode: (mode: TerminalMode) => void = () => {};

/** Prints nothing; keeps the hook's result for the test, in the mode it is given. */
function Listed() {
  const [mode, setMode] = useState<TerminalMode>("owed");
  switchMode = setMode;
  shown = useShownList(mode);
  return <text>{mode}</text>;
}

describe("useShownList", () => {
  it("keeps how many rows the list showed, at least one, and where each mode's list was scrolled", async () => {
    const screen = await draw(<Listed />, 40, 1);
    expect(shown?.pageRows.current).toBe(1);
    expect(shown?.list.firstShown).toBe(0);
    shown?.list.onShownRows(4, 3);
    await screen.redraw(() => switchMode("activity"));
    expect(shown?.pageRows.current).toBe(4);
    expect(shown?.list.firstShown).toBe(0);
    shown?.list.onShownRows(0, 1);
    expect(shown?.pageRows.current).toBe(1);
    await screen.redraw(() => switchMode("owed"));
    expect(shown?.list.firstShown).toBe(3);
  });
});

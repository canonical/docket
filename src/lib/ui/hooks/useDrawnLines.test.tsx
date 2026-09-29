import { useEffect } from "react";
import { describe, expect, it } from "vitest";
import { draw } from "../../../testing/terminal.js";
import useDrawnLines from "./useDrawnLines.js";

let report: (key: string, lines: number) => void = () => {};

/** Prints what the list counts for `a` and `b`, the snapshot giving 2 for each. */
function Counted() {
  const drawn = useDrawnLines();
  report = (key, lines) => drawn.report(key)(lines);
  return <text>{`${drawn.measure("a", 2)} ${drawn.measure("b", 2)}`}</text>;
}

/** An accordion that reports `lines` for `key` once drawn. */
function Reporting({ lines }: { lines: number }) {
  const drawn = useDrawnLines();
  useEffect(() => drawn.report("a")(lines));
  return <text>{`${drawn.measure("a", 2)}`}</text>;
}

describe("useDrawnLines", () => {
  it("counts what the snapshot gives until the item's accordion draws, then what it drew, for that item only", async () => {
    const screen = await draw(<Counted />, 40, 1);
    expect(screen.lines.at(0)?.trim()).toBe("2 2");
    const grown = await screen.redraw(() => report("a", 5));
    expect(grown.lines.at(0)?.trim()).toBe("5 2");
    const moved = await screen.redraw(() => report("b", 3));
    expect(moved.lines.at(0)?.trim()).toBe("2 3");
  });

  it("settles once the accordion reports the same height again", async () => {
    const screen = await draw(<Reporting lines={4} />, 40, 1);
    expect((await screen.redraw()).lines.at(0)?.trim()).toBe("4");
  });
});

import { describe, expect, it } from "vitest";
import { draw } from "../testing/terminal.js";
import useHelp, { type UseHelpResult } from "./useHelp.js";

let help: UseHelpResult | undefined;

/** Prints whether the help shows, and the place it is drawn from. */
function Helped() {
  help = useHelp();
  return <text>{`${help.open ? "open" : "closed"} ${help.first}`}</text>;
}

/** Runs `step` on the help, and reads back what it prints. */
const run = async (
  screen: Awaited<ReturnType<typeof draw>>,
  step: (shown: UseHelpResult) => void,
) =>
  (
    await screen.redraw(() => {
      if (help) step(help);
    })
  ).lines.at(0);

describe("useHelp", () => {
  it("opens and closes, from its top each time it opens", async () => {
    const screen = await draw(<Helped />, 40, 1);
    expect(screen.lines).toEqual(["closed 0"]);
    expect(await run(screen, ({ toggle }) => toggle())).toBe("open 0");
    await run(screen, ({ scroll }) => scroll(3));
    expect(await run(screen, ({ close }) => close())).toBe("closed 3");
    expect(await run(screen, ({ toggle }) => toggle())).toBe("open 0");
    expect(await run(screen, ({ toggle }) => toggle())).toBe("closed 0");
  });

  it("scrolls by steps and pages from where it was last drawn, never above its top", async () => {
    const screen = await draw(<Helped />, 40, 1);
    await run(screen, ({ toggle }) => toggle());
    help?.onShown(4, 6);
    expect(await run(screen, ({ scroll }) => scroll(1))).toBe("open 7");
    expect(await run(screen, ({ page }) => page(1))).toBe("open 10");
    expect(await run(screen, ({ page }) => page(-1))).toBe("open 2");
    expect(await run(screen, ({ scroll }) => scroll(-9))).toBe("open 0");
    help?.onShown(0, 2);
    expect(await run(screen, ({ page }) => page(1))).toBe("open 3");
  });

  it("goes to its top, or past its end, which the help draws as its end", async () => {
    const screen = await draw(<Helped />, 40, 1);
    await run(screen, ({ toggle }) => toggle());
    expect(await run(screen, ({ end }) => end(1))).toBe(
      `open ${Number.MAX_SAFE_INTEGER}`,
    );
    expect(await run(screen, ({ end }) => end(-1))).toBe("open 0");
  });
});

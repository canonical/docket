import { describe, expect, it, vi } from "vitest";
import { createAttention } from "../lib/cache/index.js";
import { draw } from "../testing/terminal.js";
import useAttention, { type UseAttentionProps } from "./useAttention.js";

function Probe(props: UseAttentionProps) {
  return <text>{useAttention(props)}</text>;
}

/** An attention held active, which counts the keys it hears. */
const counting = () => ({
  press: vi.fn(),
  state: () => "active" as const,
  subscribe: () => () => {},
});

describe("useAttention", () => {
  it("counts each key the terminal sends", async () => {
    const attention = counting();
    const screen = await draw(<Probe attention={attention} />, 40, 1);
    await screen.redraw(() => {
      screen.setup.mockInput.pressKey("j");
      screen.setup.mockInput.pressArrow("down");
    });
    expect(attention.press).toHaveBeenCalledTimes(2);
  });

  it("counts nothing once the pane is gone", async () => {
    const attention = counting();
    const screen = await draw(<Probe attention={attention} />, 40, 1);
    screen.setup.renderer.destroy();
    screen.setup.mockInput.pressKey("j");
    expect(attention.press).not.toHaveBeenCalled();
  });

  it("gives the pane's state, and draws again when it changes", async () => {
    vi.useFakeTimers();
    const attention = createAttention();
    const screen = await draw(<Probe attention={attention} />, 40, 1);
    expect(screen.lines.at(0)).toBe("active");
    vi.advanceTimersByTime(1_200_000);
    expect((await screen.redraw()).lines.at(0)).toBe("idle");
    attention.stop();
    vi.useRealTimers();
  });

  it("listens to nothing, and gives active, without a refresh cycle to follow it", async () => {
    const count = (screen: Awaited<ReturnType<typeof draw>>) =>
      screen.setup.renderer.keyInput.listenerCount("keypress");
    const plain = await draw(<text>listening</text>, 40, 1);
    const probe = await draw(<Probe attention={undefined} />, 40, 1);
    expect(count(probe)).toBe(count(plain));
    expect(probe.lines.at(0)).toBe("active");
  });
});

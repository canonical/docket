import { describe, expect, it, vi } from "vitest";
import { draw } from "../testing/terminal.js";
import useAttention, { type UseAttentionProps } from "./useAttention.js";

function Probe(props: UseAttentionProps) {
  useAttention(props);
  return <text>listening</text>;
}

describe("useAttention", () => {
  it("counts each key the terminal sends", async () => {
    const attention = { press: vi.fn() };
    const screen = await draw(<Probe attention={attention} />, 40, 1);
    await screen.redraw(() => {
      screen.setup.mockInput.pressKey("j");
      screen.setup.mockInput.pressArrow("down");
    });
    expect(attention.press).toHaveBeenCalledTimes(2);
  });

  it("counts nothing once the pane is gone", async () => {
    const attention = { press: vi.fn() };
    const screen = await draw(<Probe attention={attention} />, 40, 1);
    screen.setup.renderer.destroy();
    screen.setup.mockInput.pressKey("j");
    expect(attention.press).not.toHaveBeenCalled();
  });

  it("listens to nothing without a refresh cycle to follow it", async () => {
    const count = (screen: Awaited<ReturnType<typeof draw>>) =>
      screen.setup.renderer.keyInput.listenerCount("keypress");
    const plain = await draw(<text>listening</text>, 40, 1);
    const probe = await draw(<Probe attention={undefined} />, 40, 1);
    expect(count(probe)).toBe(count(plain));
  });
});

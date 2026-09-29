import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import createAttention from "./createAttention.js";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const minute = 60_000;

describe("createAttention", () => {
  it("turns idle 20 minutes after it opens with no key, telling its listeners", () => {
    const attention = createAttention();
    const listener = vi.fn();
    attention.subscribe(listener);
    vi.advanceTimersByTime(20 * minute - 1);
    expect(attention.state()).toBe("active");
    vi.advanceTimersByTime(1);
    expect(attention.state()).toBe("idle");
    expect(listener).toHaveBeenCalledOnce();
  });

  it("counts the 20 minutes again from each key", () => {
    const attention = createAttention();
    vi.advanceTimersByTime(15 * minute);
    attention.press();
    vi.advanceTimersByTime(15 * minute);
    expect(attention.state()).toBe("active");
    vi.advanceTimersByTime(5 * minute);
    expect(attention.state()).toBe("idle");
  });

  it("wakes on the first key once idle, and is active again once settled", () => {
    const attention = createAttention();
    vi.advanceTimersByTime(20 * minute);
    attention.press();
    expect(attention.state()).toBe("waking");
    attention.press();
    expect(attention.state()).toBe("waking");
    attention.settle();
    expect(attention.state()).toBe("active");
  });

  it("stays active when settled without having woken", () => {
    const attention = createAttention();
    const listener = vi.fn();
    attention.subscribe(listener);
    attention.settle();
    expect(attention.state()).toBe("active");
    expect(listener).not.toHaveBeenCalled();
  });

  it("tells a listener nothing once it unsubscribed, and never turns idle once stopped", () => {
    const attention = createAttention();
    const listener = vi.fn();
    attention.subscribe(listener)();
    vi.advanceTimersByTime(20 * minute);
    expect(listener).not.toHaveBeenCalled();
    const stopped = createAttention();
    stopped.stop();
    vi.advanceTimersByTime(60 * minute);
    expect(stopped.state()).toBe("active");
  });
});

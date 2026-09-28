import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { thread } from "../testing/facts.js";
import { draw } from "../testing/terminal.js";
import useSelectedWatch, {
  type UseSelectedWatchProps,
} from "./useSelectedWatch.js";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const second = 1_000;

function Probe(props: UseSelectedWatchProps) {
  useSelectedWatch(props);
  return <text>watching</text>;
}

const watching = () => ({ refreshIfChanged: vi.fn(async () => false) });

describe("useSelectedWatch", () => {
  it("checks the selected thread's repository every 60 seconds while the pane is active", async () => {
    const cache = watching();
    await draw(
      <Probe cache={cache} selected={thread()} attention="active" />,
      40,
      1,
    );
    await vi.advanceTimersByTimeAsync(59 * second);
    expect(cache.refreshIfChanged).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1 * second);
    expect(cache.refreshIfChanged).toHaveBeenCalledWith(
      "example-org/example-repo",
    );
    await vi.advanceTimersByTimeAsync(60 * second);
    expect(cache.refreshIfChanged).toHaveBeenCalledTimes(2);
  });

  it("starts the 60 seconds over when the selection moves", async () => {
    const cache = watching();
    let select = (_number: number) => {};
    const Moving = () => {
      const [number, setNumber] = useState(1);
      select = setNumber;
      return (
        <Probe cache={cache} selected={thread({ number })} attention="active" />
      );
    };
    const screen = await draw(<Moving />, 40, 1);
    await vi.advanceTimersByTimeAsync(40 * second);
    await screen.redraw(() => select(2));
    await vi.advanceTimersByTimeAsync(40 * second);
    expect(cache.refreshIfChanged).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(20 * second);
    expect(cache.refreshIfChanged).toHaveBeenCalledOnce();
  });

  it("checks nothing while the pane is idle or waking, with nothing selected, or with no cache", async () => {
    const cache = watching();
    await draw(
      <Probe cache={cache} selected={thread()} attention="idle" />,
      40,
      1,
    );
    await draw(
      <Probe cache={cache} selected={thread()} attention="waking" />,
      40,
      1,
    );
    await draw(
      <Probe cache={cache} selected={undefined} attention="active" />,
      40,
      1,
    );
    await draw(
      <Probe cache={undefined} selected={thread()} attention="active" />,
      40,
      1,
    );
    await vi.advanceTimersByTimeAsync(10 * 60 * second);
    expect(cache.refreshIfChanged).not.toHaveBeenCalled();
  });

  it("keeps checking after a check fails", async () => {
    const cache = {
      refreshIfChanged: vi.fn(async () => {
        throw new Error("offline");
      }),
    };
    await draw(
      <Probe cache={cache} selected={thread()} attention="active" />,
      40,
      1,
    );
    await vi.advanceTimersByTimeAsync(120 * second);
    expect(cache.refreshIfChanged).toHaveBeenCalledTimes(2);
  });
});

import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AttentionState } from "../lib/cache/index.js";
import type { ThreadSummary } from "../lib/waits/index.js";
import { thread } from "../testing/facts.js";
import { parserFixDetail } from "../testing/recorded.js";
import { draw } from "../testing/terminal.js";
import createDetailReader from "./createDetailReader.js";
import useReadAhead, {
  type UseReadAheadProps,
  type UseReadAheadResult,
} from "./useReadAhead.js";

beforeEach(() => {
  vi.useFakeTimers({
    now: new Date("2026-09-28T10:00:00Z"),
    toFake: ["setTimeout", "clearTimeout", "Date"],
  });
});

afterEach(() => {
  vi.useRealTimers();
});

/** Twenty rows, each its own thread, at version `v`. */
const rows = Array.from({ length: 20 }, (_, index) => ({
  thread: thread({ number: index + 1 }),
  version: "v",
}));

/** A reader over a provider that finds every thread, counting requests. */
const reading = () => {
  const readDetails = vi.fn(async (threads: readonly ThreadSummary[]) =>
    threads.map(() => parserFixDetail),
  );
  return { readDetails, reader: createDetailReader(readDetails) };
};

let result: UseReadAheadResult | undefined;
let steer: (change: Partial<UseReadAheadProps>) => void = () => {};

function Probe(props: UseReadAheadProps) {
  const [changes, setChanges] = useState<Partial<UseReadAheadProps>>({});
  steer = (change) => setChanges((current) => ({ ...current, ...change }));
  result = useReadAhead({ ...props, ...changes });
  return <text>reading</text>;
}

const open = async (
  reader: UseReadAheadProps["reader"],
  attention: AttentionState = "active",
  paused = false,
) =>
  draw(
    <Probe
      reader={reader}
      rows={rows}
      selected={0}
      attention={attention}
      paused={paused}
      now={() => new Date()}
    />,
    40,
    1,
  );

describe("useReadAhead", () => {
  it("reads the selected thread and the 13 rows nearest it in one request as the list first shows", async () => {
    const { readDetails, reader } = reading();
    await open(reader);
    await vi.advanceTimersByTimeAsync(0);
    expect(readDetails).toHaveBeenCalledOnce();
    const [asked] = readDetails.mock.calls.at(0) ?? [];
    expect(asked?.map(({ number }) => number)).toEqual(
      Array.from({ length: 14 }, (_, index) => index + 1),
    );
  });

  it("reads 200 milliseconds after the selection rests, only the rows not read yet, around it", async () => {
    const { readDetails, reader } = reading();
    const screen = await open(reader);
    await vi.advanceTimersByTimeAsync(0);
    await screen.redraw(() => steer({ selected: 15 }));
    await vi.advanceTimersByTimeAsync(199);
    expect(readDetails).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);
    expect(readDetails).toHaveBeenCalledTimes(2);
    const [asked] = readDetails.mock.calls.at(1) ?? [];
    expect(asked?.map(({ number }) => number)).toEqual([
      16, 15, 17, 18, 19, 20,
    ]);
  });

  it("reads the selected thread again once its details are 30 seconds old, and moves its version when they arrive", async () => {
    const { readDetails, reader } = reading();
    const screen = await open(reader);
    await vi.advanceTimersByTimeAsync(0);
    const first = rows.at(0)?.thread ?? thread();
    const arrived = result?.version(first, "v");
    await vi.advanceTimersByTimeAsync(30_000);
    await screen.redraw(() => steer({ selected: 1 }));
    await vi.advanceTimersByTimeAsync(200);
    expect(readDetails).toHaveBeenCalledTimes(2);
    await screen.redraw();
    expect(result?.version(first, "v")).not.toBe(arrived);
    expect(await result?.read?.(first, "v")).toBe(parserFixDetail);
  });

  it("reads nothing ahead while the pane is idle or the refresh paused, and catches up once it is not", async () => {
    const { readDetails, reader } = reading();
    const screen = await open(reader, "idle");
    await vi.advanceTimersByTimeAsync(1_000);
    await screen.redraw(() => steer({ attention: "active", paused: true }));
    await vi.advanceTimersByTimeAsync(1_000);
    expect(readDetails).not.toHaveBeenCalled();
    await screen.redraw(() => steer({ paused: false }));
    await vi.advanceTimersByTimeAsync(1_000);
    expect(readDetails).toHaveBeenCalledOnce();
  });

  it("reads nothing ahead with no reader or no rows, and leaves the version as given", async () => {
    await open(undefined);
    expect(result?.read).toBeUndefined();
    expect(result?.version(thread(), "v")).toBe("v");
    const { readDetails, reader } = reading();
    await draw(
      <Probe
        reader={reader}
        rows={[]}
        selected={0}
        attention="active"
        paused={false}
        now={() => new Date()}
      />,
      40,
      1,
    );
    await vi.advanceTimersByTimeAsync(1_000);
    expect(readDetails).not.toHaveBeenCalled();
  });
});

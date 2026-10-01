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
  return {
    readDetails,
    reader: createDetailReader(readDetails, () => true),
  };
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
  paused?: UseReadAheadProps["paused"],
) =>
  draw(
    <Probe
      reader={reader}
      rows={rows}
      selected={0}
      attention={attention}
      paused={paused}
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

  it("never reads an unchanged thread again, however long ago it was read, and reads a changed one alone", async () => {
    const { readDetails, reader } = reading();
    const screen = await open(reader);
    await vi.advanceTimersByTimeAsync(0);
    const first = rows.at(0)?.thread ?? thread();
    const arrived = result?.version(first, "v");
    await vi.advanceTimersByTimeAsync(3_600_000);
    await screen.redraw(() => steer({ selected: 1 }));
    await vi.advanceTimersByTimeAsync(200);
    await screen.redraw(() => steer({ selected: 0 }));
    await vi.advanceTimersByTimeAsync(200);
    expect(readDetails).toHaveBeenCalledOnce();
    const changed = rows.map((row, place) =>
      place === 0 ? { ...row, version: "w" } : row,
    );
    await screen.redraw(() => steer({ rows: changed }));
    await vi.advanceTimersByTimeAsync(200);
    expect(readDetails).toHaveBeenCalledTimes(2);
    expect(readDetails.mock.calls.at(1)?.[0]).toEqual([first]);
    await screen.redraw();
    expect(result?.version(first, "w")).not.toBe(arrived);
    expect(await result?.read?.(first, "w")).toBe(parserFixDetail);
  });

  it("reads nothing while the pane is idle or the rate limit pauses reading, the accordion's read included, and catches up once it does not", async () => {
    const { readDetails, reader } = reading();
    const screen = await open(reader, "idle");
    await vi.advanceTimersByTimeAsync(1_000);
    await screen.redraw(() =>
      steer({ attention: "active", paused: "rateLimit" }),
    );
    const first = rows.at(0)?.thread ?? thread();
    const waiting = result?.read?.(first, "v");
    await vi.advanceTimersByTimeAsync(1_000);
    expect(readDetails).not.toHaveBeenCalled();
    await screen.redraw(() => steer({ paused: undefined }));
    await vi.advanceTimersByTimeAsync(1_000);
    expect(readDetails).toHaveBeenCalledOnce();
    expect(await waiting).toBe(parserFixDetail);
  });

  it("reads only the selected thread below the budget floor, and the rows around it once above it", async () => {
    const { readDetails, reader } = reading();
    const screen = await open(reader, "active", "budget");
    await vi.advanceTimersByTimeAsync(0);
    await screen.redraw(() => steer({ selected: 5 }));
    await vi.advanceTimersByTimeAsync(200);
    const listAsked = () =>
      readDetails.mock.calls.map(([threads]) =>
        threads.map(({ number }) => number),
      );
    expect(listAsked()).toEqual([[1], [6]]);
    await screen.redraw(() => steer({ paused: undefined }));
    await vi.advanceTimersByTimeAsync(200);
    expect(listAsked().at(2)).toHaveLength(12);
  });

  it("reads the rows around the selection again once their details are dropped, and moves their versions when they arrive", async () => {
    const { readDetails, reader } = reading();
    const screen = await open(reader);
    await vi.advanceTimersByTimeAsync(0);
    const first = rows.at(0)?.thread ?? thread();
    const arrived = result?.version(first, "v");
    await screen.redraw(() => result?.drop());
    await vi.advanceTimersByTimeAsync(200);
    expect(readDetails).toHaveBeenCalledTimes(2);
    expect(readDetails.mock.calls.at(1)?.[0]).toEqual(
      readDetails.mock.calls.at(0)?.[0],
    );
    await screen.redraw();
    expect(result?.version(first, "v")).not.toBe(arrived);
  });

  it("counts the details read of those asked for while any are pending, and none once all are read", async () => {
    const { promise, resolve } = Promise.withResolvers<void>();
    const readDetails = vi.fn(async (threads: readonly ThreadSummary[]) => {
      await promise;
      return threads.map(() => parserFixDetail);
    });
    const screen = await open(createDetailReader(readDetails, () => true));
    await screen.redraw();
    expect(result?.progress).toEqual({ read: 0, asked: 14 });
    resolve();
    await vi.advanceTimersByTimeAsync(0);
    await screen.redraw();
    expect(readDetails).toHaveBeenCalledOnce();
    expect(result?.progress).toBeUndefined();
  });

  it("reads nothing ahead with no reader or no rows, and leaves the version as given", async () => {
    await open(undefined);
    expect(result?.read).toBeUndefined();
    result?.drop();
    expect(result?.version(thread(), "v")).toBe("v");
    const { readDetails, reader } = reading();
    await draw(
      <Probe
        reader={reader}
        rows={[]}
        selected={0}
        attention="active"
        paused={undefined}
      />,
      40,
      1,
    );
    await vi.advanceTimersByTimeAsync(1_000);
    expect(readDetails).not.toHaveBeenCalled();
  });
});

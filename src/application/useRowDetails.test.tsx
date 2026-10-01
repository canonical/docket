import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ThreadSummary } from "../lib/waits/index.js";
import { findFinishedRow } from "../testing/finished.js";
import { parserFixDetail } from "../testing/recorded.js";
import { draw } from "../testing/terminal.js";
import createDetailReader from "./createDetailReader.js";
import type { ListRow } from "./types.js";
import useRowDetails, { type UseRowDetailsResult } from "./useRowDetails.js";

beforeEach(() => {
  vi.useFakeTimers({
    now: new Date("2026-09-28T10:00:00Z"),
    toFake: ["setTimeout", "clearTimeout", "Date"],
  });
});

afterEach(() => {
  vi.useRealTimers();
});

/** finished's rows: a stacked pull request, and an issue in no stack. */
const stacked = findFinishedRow("example#2");
const unstacked = findFinishedRow("example#7");
const rows: readonly ListRow[] = [unstacked, stacked];

let result: UseRowDetailsResult | undefined;
let select: (row: ListRow) => void = () => {};

/** Reads the rows' details with `readDetails`, the selection on `first`. */
async function open(
  readDetails: (threads: readonly ThreadSummary[]) => Promise<unknown[]>,
  first: ListRow,
) {
  const reader = createDetailReader(
    readDetails as Parameters<typeof createDetailReader>[0],
    () => true,
  );
  function Probe() {
    const [selected, setSelected] = useState(first);
    select = setSelected;
    result = useRowDetails({
      reader,
      rows,
      selected,
      drawnSelected: () => selected,
      held: [],
      findFacts: () => undefined,
      attention: "active",
      status: undefined,
    });
    return <text>reading</text>;
  }
  return draw(<Probe />, 40, 1);
}

describe("useRowDetails", () => {
  it("reads ahead nothing while a finished thread in no stack is selected, and a stacked pull request's details once one is", async () => {
    const asked: number[][] = [];
    const readDetails = async (threads: readonly ThreadSummary[]) => {
      asked.push(threads.map(({ number }) => number));
      return threads.map(() => parserFixDetail);
    };
    const screen = await open(readDetails, unstacked);
    await screen.redraw(() => vi.advanceTimersByTime(1_000));
    expect(asked).toEqual([]);
    await screen.redraw(() => select(stacked));
    await screen.redraw(() => vi.advanceTimersByTime(1_000));
    expect(asked.flat()).toEqual([2]);
  });

  it("gives a row's accordion the details read for its thread", async () => {
    const readDetails = async (threads: readonly ThreadSummary[]) =>
      threads.map(() => parserFixDetail);
    const screen = await open(readDetails, stacked);
    await screen.redraw(() => vi.advanceTimersByTime(1_000));
    const readAlone = vi.fn(async () => parserFixDetail);
    const detail = await result?.readRowDetail(stacked, readAlone);
    expect(detail).toMatchObject({ files: parserFixDetail.files });
    result?.drop();
  });
});

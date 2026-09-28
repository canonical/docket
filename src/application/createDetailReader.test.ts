import { describe, expect, it, vi } from "vitest";
import { thread } from "../testing/facts.js";
import { parserFixDetail } from "../testing/recorded.js";
import createDetailReader from "./createDetailReader.js";

const at = new Date("2026-09-28T10:00:00Z");
const minute = 60_000;
const laterBy = (milliseconds: number) => new Date(at.getTime() + milliseconds);
const threads = Array.from({ length: 20 }, (_, index) =>
  thread({ number: index + 1 }),
);

/** Reads every thread's details, as one request, finding all but #13. */
const readAll = () =>
  vi.fn(async (asked: readonly { number: number }[]) =>
    asked.map(({ number }) => (number === 13 ? undefined : parserFixDetail)),
  );

describe("createDetailReader", () => {
  it("reads at most 14 threads in one request, each with its details or none", async () => {
    const readDetails = readAll();
    const read = await createDetailReader(readDetails).read(
      threads,
      undefined,
      at,
    );
    expect(readDetails).toHaveBeenCalledOnce();
    expect(read).toHaveLength(14);
    expect(read.at(0)).toEqual({
      thread: threads.at(0),
      detail: parserFixDetail,
    });
    expect(read.at(12)?.detail).toBeUndefined();
  });

  it("asks nothing when given nothing to read", async () => {
    const readDetails = readAll();
    expect(
      await createDetailReader(readDetails).read([], undefined, at),
    ).toEqual([]);
    expect(readDetails).not.toHaveBeenCalled();
  });

  it("reads only the selected thread once 300 reads spent the hour's budget, and says so until the hour is over", async () => {
    const readDetails = readAll();
    const reader = createDetailReader(readDetails);
    const [first, second] = threads;
    for (let count = 0; count < 300; count += 1) {
      expect(reader.isCapped(at)).toBe(false);
      await reader.read([first], first, at);
    }
    expect(reader.isCapped(laterBy(59 * minute))).toBe(true);
    const capped = await reader.read(
      threads.slice(0, 3),
      second,
      laterBy(59 * minute),
    );
    expect(capped.map(({ thread: read }) => read)).toEqual([second]);
    expect(await reader.read([first], undefined, laterBy(59 * minute))).toEqual(
      [],
    );
    expect(reader.isCapped(laterBy(60 * minute))).toBe(false);
    const renewed = await reader.read(
      threads.slice(0, 3),
      second,
      laterBy(60 * minute),
    );
    expect(renewed).toHaveLength(3);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { thread } from "../testing/facts.js";
import { parserFixDetail } from "../testing/recorded.js";
import createDetailQueue from "./createDetailQueue.js";
import type { DetailReading } from "./createDetailReader.js";

beforeEach(() => {
  vi.useFakeTimers({ now: new Date("2026-09-28T10:00:00Z") });
});

afterEach(() => {
  vi.useRealTimers();
});

const one = thread({ number: 1 });
const two = thread({ number: 2 });
const three = thread({ number: 3 });
const four = thread({ number: 4 });

/** A reader finding every thread but #3, which counts what it is asked. */
const reading = () => ({
  read: vi.fn(
    async (
      threads: readonly (typeof one)[],
      _selected?: typeof one,
    ): Promise<DetailReading> =>
      threads.map((each) => ({
        thread: each,
        detail: each.number === 3 ? undefined : parserFixDetail,
      })),
  ),
});
const open = (reader = reading()) => createDetailQueue(reader);

/** A reader whose every request waits until the test answers it. */
const waiting = () => {
  const answers: (() => void)[] = [];
  const reader = {
    read: vi.fn(
      (threads: readonly (typeof one)[]): Promise<DetailReading> =>
        new Promise((resolve) =>
          answers.push(() =>
            resolve(
              threads.map((each) => ({
                thread: each,
                detail: each.number === 3 ? undefined : parserFixDetail,
              })),
            ),
          ),
        ),
    ),
  };
  return { reader, answer: () => answers.shift()?.() };
};
const wanted = (...threads: (typeof one)[]) =>
  threads.map((each) => ({ thread: each, version: "v" }));

describe("createDetailQueue's count of details", () => {
  it("counts the threads asked for with nothing pending, and those answered, found or not, until nothing is pending", async () => {
    const { reader, answer } = waiting();
    const queue = open(reader);
    expect(queue.countDetails()).toBeUndefined();
    queue.request(wanted(one, two, three), one, 0);
    expect(queue.countDetails()).toEqual({ read: 0, asked: 3 });
    await vi.advanceTimersByTimeAsync(0);
    queue.read(four, "v");
    expect(queue.countDetails()).toEqual({ read: 0, asked: 4 });
    answer();
    await vi.advanceTimersByTimeAsync(0);
    expect(queue.countDetails()).toEqual({ read: 3, asked: 4 });
    answer();
    await vi.advanceTimersByTimeAsync(0);
    expect(queue.countDetails()).toBeUndefined();
  });

  it("counts the selected thread alone when only its details are read again", async () => {
    const { reader, answer } = waiting();
    const queue = open(reader);
    queue.request(wanted(one, two), one, 0);
    await vi.advanceTimersByTimeAsync(0);
    answer();
    await vi.advanceTimersByTimeAsync(0);
    queue.read(one, "w");
    expect(queue.countDetails()).toEqual({ read: 0, asked: 1 });
  });

  it("no longer counts a thread that gives way to a later window, or that a request leaves out", async () => {
    const reader = { read: vi.fn(async (): Promise<DetailReading> => []) };
    const queue = open(reader);
    queue.request(wanted(one, two), one, 200);
    queue.request(wanted(two), two, 200);
    expect(queue.countDetails()).toEqual({ read: 0, asked: 1 });
    queue.read(three, "v");
    await vi.advanceTimersByTimeAsync(200);
    expect(queue.countDetails()).toBeUndefined();
  });

  it("ends the count when the window asks for nothing more, with nothing sent", () => {
    const queue = open();
    queue.request(wanted(one), one, 200);
    queue.request([], undefined, 200);
    expect(queue.countDetails()).toBeUndefined();
  });

  it("counts nothing while paused, and takes the count up again once it is not", async () => {
    const queue = open();
    queue.request(wanted(one, two), one, 200);
    queue.pause(true);
    expect(queue.countDetails()).toBeUndefined();
    queue.pause(false);
    expect(queue.countDetails()).toEqual({ read: 0, asked: 2 });
    await vi.advanceTimersByTimeAsync(0);
    expect(queue.countDetails()).toBeUndefined();
  });

  it("tells its listeners when the count opens, moves and ends, and not when it stays", async () => {
    const { reader, answer } = waiting();
    const queue = open(reader);
    const listener = vi.fn();
    queue.subscribe(listener);
    queue.request(wanted(one), one, 0);
    queue.request(wanted(one), one, 0);
    expect(listener).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(0);
    answer();
    await vi.advanceTimersByTimeAsync(0);
    expect(listener).toHaveBeenCalledTimes(2);
    queue.pause(true);
    queue.pause(true);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("counts nothing once stopped", () => {
    const queue = open();
    queue.request(wanted(one), one, 200);
    queue.stop();
    expect(queue.countDetails()).toBeUndefined();
  });
});

/**
 * A reader whose every request waits until the test settles it, the
 * oldest first: with the details found for the threads `settle` keeps,
 * or failing with `reason`.
 */
const holdReadings = () => {
  const pending: {
    readonly threads: readonly (typeof one)[];
    readonly resolve: (reading: DetailReading) => void;
    readonly reject: (reason: unknown) => void;
  }[] = [];
  const reader = {
    read: vi.fn(
      (threads: readonly (typeof one)[]) =>
        new Promise<DetailReading>((resolve, reject) =>
          pending.push({ threads, resolve, reject }),
        ),
    ),
  };
  const next = () => {
    const first = pending.shift();
    if (!first) throw new Error("no request is pending");
    return first;
  };
  return {
    reader,
    answer: (keep: (thread: typeof one) => boolean) => {
      const { threads, resolve } = next();
      resolve(
        threads
          .filter(keep)
          .map((each) => ({ thread: each, detail: parserFixDetail })),
      );
    },
    fail: (reason: unknown) => next().reject(reason),
  };
};

/** Two requests under way: `one` and `two` read ahead, then `four` alone. */
async function overlap(reader: ReturnType<typeof holdReadings>["reader"]) {
  const queue = open(reader);
  queue.request(wanted(one, two), one, 0);
  await vi.advanceTimersByTimeAsync(0);
  void queue.read(four, "v").catch(() => {});
  await vi.advanceTimersByTimeAsync(0);
  expect(reader.read).toHaveBeenCalledTimes(2);
  return queue;
}

describe("createDetailQueue's count of details while requests overlap", () => {
  it("stops counting as asked a thread the reader left out", async () => {
    const { reader, answer } = holdReadings();
    const queue = await overlap(reader);
    answer((each) => each.number === 1);
    await vi.advanceTimersByTimeAsync(0);
    expect(queue.countDetails()).toEqual({ read: 1, asked: 2 });
  });

  it("counts as answered each thread of a request that failed", async () => {
    const { reader, fail } = holdReadings();
    const queue = await overlap(reader);
    fail(new Error("offline"));
    await vi.advanceTimersByTimeAsync(0);
    expect(queue.countDetails()).toEqual({ read: 2, asked: 3 });
  });

  it("counts again as unread a thread asked for at a new version after its answer", async () => {
    const { reader, answer } = holdReadings();
    const queue = await overlap(reader);
    answer(() => true);
    await vi.advanceTimersByTimeAsync(0);
    expect(queue.countDetails()).toEqual({ read: 2, asked: 3 });
    void queue.read(one, "w");
    expect(queue.countDetails()).toEqual({ read: 1, asked: 3 });
  });
});

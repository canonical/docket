import { act, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ThreadDetail } from "../lib/provider/index.js";
import type { Thread, ThreadSummary } from "../lib/waits/index.js";
import { providerError } from "../testing/provider.js";
import { crash, parserFix, parserFixDetail } from "../testing/recorded.js";
import { draw } from "../testing/terminal.js";
import createDetailQueue from "./createDetailQueue.js";
import useHeldDetails, {
  type UseHeldDetailsProps,
  type UseHeldDetailsResult,
} from "./useHeldDetails.js";

/**
 * The hook on `start`, with `give` asking it for a thread's details at a
 * version, `change` setting its props as the screen would, and `drawn`
 * counting the frames drawn.
 */
async function probe(start: UseHeldDetailsProps) {
  let readHeld: UseHeldDetailsResult = () => Promise.reject();
  let change: (props: Partial<UseHeldDetailsProps>) => void = () => {};
  let drawn = 0;
  function Probe() {
    const [props, setProps] = useState(start);
    change = (next) => setProps((current) => ({ ...current, ...next }));
    readHeld = useHeldDetails(props);
    drawn += 1;
    return <text>held</text>;
  }
  await draw(<Probe />, 10, 1);
  return {
    give: (
      read: (thread: ThreadSummary) => Promise<ThreadDetail>,
      thread: ThreadSummary,
      version: string,
      facts?: Thread,
    ) => readHeld(read, thread, version, facts),
    change: (props: Partial<UseHeldDetailsProps>) =>
      act(async () => change(props)),
    drawn: () => drawn,
  };
}

/** When reading resumes, in the tests that pause it. */
const resumes = new Date("2026-09-28T13:00:00Z");

describe("useHeldDetails", () => {
  it("gives the details read for a thread, reading them once while its version stays", async () => {
    const read = vi.fn(async () => parserFixDetail);
    const { give } = await probe({
      kept: [parserFix],
      selected: () => parserFix,
    });
    const first = give(read, parserFix, "1");
    expect(give(read, parserFix, "1")).toBe(first);
    expect(await first).toBe(parserFixDetail);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("gives the earlier details until a changed thread's read settles, then the new, drawing once more", async () => {
    const changed = { ...parserFixDetail, labels: ["kind=docs"] };
    const later = Promise.withResolvers<ThreadDetail>();
    const read = vi.fn(async () => parserFixDetail);
    read.mockResolvedValueOnce(parserFixDetail);
    read.mockReturnValueOnce(later.promise);
    const { give, drawn } = await probe({
      kept: [parserFix],
      selected: () => parserFix,
    });
    const first = give(read, parserFix, "1");
    await first;
    expect(give(read, parserFix, "2")).toBe(first);
    const frames = drawn();
    await act(async () => later.resolve(changed));
    expect(drawn()).toBe(frames + 1);
    expect(await give(read, parserFix, "2")).toBe(changed);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("reads a failed thread again only once the selection arrives on it", async () => {
    const read = vi.fn(async () => parserFixDetail);
    read.mockRejectedValueOnce(providerError("GITHUB_TIMED_OUT"));
    let selected: ThreadSummary = parserFix;
    const { give } = await probe({
      kept: [parserFix, crash],
      selected: () => selected,
    });
    await expect(give(read, parserFix, "1")).rejects.toThrow();
    await expect(give(read, parserFix, "1")).rejects.toThrow();
    expect(read).toHaveBeenCalledTimes(1);
    selected = crash;
    expect(await give(read, parserFix, "1")).toBe(parserFixDetail);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("lets go of a thread's details once it is no longer kept", async () => {
    const read = vi.fn(async () => parserFixDetail);
    const { give, change } = await probe({
      kept: [parserFix],
      selected: () => undefined,
    });
    await give(read, parserFix, "1");
    await change({ kept: [crash] });
    await change({ kept: [parserFix] });
    await give(read, parserFix, "1");
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("reads nothing while reading is paused, giving the details held whatever the version", async () => {
    const read = vi.fn(async () => parserFixDetail);
    const { give, change } = await probe({
      kept: [parserFix],
      selected: () => parserFix,
    });
    const first = give(read, parserFix, "1");
    await first;
    await change({ resumes });
    expect(give(read, parserFix, "2")).toBe(first);
    expect(read).toHaveBeenCalledTimes(1);
    await change({ resumes: undefined });
    expect(await give(read, parserFix, "2")).toBe(parserFixDetail);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("gives a thread with no details held what the snapshot holds while reading is paused, settled at once and marked partial", async () => {
    const read = vi.fn(async () => parserFixDetail);
    const { give } = await probe({
      kept: [crash],
      selected: () => crash,
      resumes,
    });
    const given = give(read, crash, "1", crash);
    expect(given).toMatchObject({ status: "fulfilled" });
    expect(await given).toMatchObject({
      partial: true,
      createdAt: crash.createdAt,
      labels: crash.labels,
    });
    expect(read).not.toHaveBeenCalled();
  });

  it("gives what the snapshot holds, settled at once, for a read queued but not sent when reading pauses, and sends it once reading resumes", async () => {
    const reader = {
      read: vi.fn(async (threads: readonly ThreadSummary[]) =>
        threads.map((each) => ({ thread: each, detail: parserFixDetail })),
      ),
    };
    const queue = createDetailQueue(reader, () => new Date());
    const read = (thread: ThreadSummary) => queue.read(thread, "1");
    const { give, change } = await probe({
      kept: [crash],
      selected: () => crash,
    });
    queue.request([{ thread: crash, version: "1" }], crash, 200);
    const queued = give(read, crash, "1", crash);
    queue.pause(true);
    await change({ resumes });
    const given = give(read, crash, "1", crash);
    expect(given).toMatchObject({ status: "fulfilled" });
    expect(await given).toMatchObject({ partial: true });
    expect(reader.read).not.toHaveBeenCalled();
    queue.pause(false);
    await change({ resumes: undefined });
    expect(await queued).toBe(parserFixDetail);
    expect(await give(read, crash, "1", crash)).toBe(parserFixDetail);
    expect(reader.read).toHaveBeenCalledOnce();
  });

  it("gives a thread the snapshot holds nothing of when reading resumes while it is paused, settled at once", async () => {
    const read = vi.fn(async () => parserFixDetail);
    const { give } = await probe({
      kept: [crash],
      selected: () => crash,
      resumes,
    });
    const given = give(read, crash, "1");
    expect(given).toMatchObject({ status: "fulfilled" });
    expect(await given).toEqual({ resumes });
    expect(read).not.toHaveBeenCalled();
  });
});

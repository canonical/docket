import { act, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { providerError } from "../testing/provider.js";
import { draw } from "../testing/terminal.js";
import useViewer, {
  type UseViewerProps,
  type UseViewerResult,
} from "./useViewer.js";

/** The hook on `start`, with `change` setting its props as the screen would. */
async function probe(start: UseViewerProps) {
  let result: UseViewerResult = {};
  let change: (props: Partial<UseViewerProps>) => void = () => {};
  function Probe() {
    const [props, setProps] = useState(start);
    change = (next) => setProps((current) => ({ ...current, ...next }));
    result = useViewer(props);
    return <text>viewer</text>;
  }
  await draw(<Probe />, 10, 1);
  return {
    result: () => result,
    change: (props: Partial<UseViewerProps>) => act(async () => change(props)),
  };
}

const synced = new Date("2026-09-28T10:00:00Z");
const later = new Date("2026-09-28T10:05:00Z");

describe("useViewer", () => {
  it("gives the login once read, and reads it once whatever syncs follow", async () => {
    const readViewer = vi.fn(async () => "alice");
    const { result, change } = await probe({ readViewer, syncedAt: synced });
    await vi.waitFor(() => expect(result()).toEqual({ viewer: "alice" }));
    await change({ syncedAt: later });
    expect(readViewer).toHaveBeenCalledOnce();
  });

  it("gives nothing without a way to read it", async () => {
    const { result } = await probe({});
    expect(result()).toEqual({});
  });

  it("names a failure, and reads again only once the cache syncs after it", async () => {
    const offline = providerError("GITHUB_UNREACHABLE");
    const readViewer = vi.fn(async () => "alice");
    readViewer.mockRejectedValueOnce(offline);
    const { result, change } = await probe({ readViewer, syncedAt: synced });
    await vi.waitFor(() => expect(result()).toEqual({ failure: offline }));
    await change({ syncedAt: synced });
    expect(readViewer).toHaveBeenCalledOnce();
    await change({ syncedAt: later });
    await vi.waitFor(() => expect(result()).toEqual({ viewer: "alice" }));
    expect(readViewer).toHaveBeenCalledTimes(2);
  });

  it("gives a defect as the problem that stands in for the list", async () => {
    const readViewer = () => Promise.reject(new TypeError("broken"));
    const { result } = await probe({ readViewer });
    await vi.waitFor(() =>
      expect(result().problem).toMatchObject({ code: "UNEXPECTED_FAILURE" }),
    );
  });

  it("drops a read, answered or failed, that settles after its reader changed", async () => {
    const answered = Promise.withResolvers<string>();
    const failed = Promise.withResolvers<string>();
    const { result, change } = await probe({
      readViewer: () => answered.promise,
    });
    await change({ readViewer: () => failed.promise });
    await change({ readViewer: async () => "bob" });
    await vi.waitFor(() => expect(result()).toEqual({ viewer: "bob" }));
    await act(async () => {
      answered.resolve("alice");
      failed.reject(providerError("GITHUB_UNREACHABLE"));
    });
    expect(result()).toEqual({ viewer: "bob" });
  });
});

import { mkdir } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import CacheError from "./CacheError.js";
import classifyFolderFailure from "./classifyFolderFailure.js";

describe("classifyFolderFailure", () => {
  it("names a filesystem failure CACHE_UNUSABLE, with its cause and the folder", async () => {
    const failure = await mkdir("/dev/null/docket").catch((error) => error);
    const named = classifyFolderFailure(failure, "/dev/null/docket");
    expect(named).toBeInstanceOf(CacheError);
    expect(named).toMatchObject({
      code: "CACHE_UNUSABLE",
      message: expect.stringMatching(
        /^docket cannot use its cache folder \/dev\/null\/docket: ENOTDIR: .+\.$/,
      ),
      recovery:
        "make /dev/null/docket a folder you can write to, or set XDG_CACHE_HOME to one",
    });
  });

  it("gives back any other failure as it is", () => {
    const defect = new TypeError("a defect");
    const network = Object.assign(new Error("reset"), { syscall: "read" });
    expect(classifyFolderFailure(defect, "/cache")).toBe(defect);
    expect(classifyFolderFailure(network, "/cache")).toBe(network);
    expect(classifyFolderFailure("text", "/cache")).toBe("text");
    expect(classifyFolderFailure(undefined, "/cache")).toBeUndefined();
  });
});

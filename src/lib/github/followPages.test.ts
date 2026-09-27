import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeGitHub, settle, token } from "../../testing/github.js";
import createClient from "./createClient.js";
import followPages from "./followPages.js";

let github: ReturnType<typeof fakeGitHub>;

beforeEach(() => {
  vi.useFakeTimers();
  github = fakeGitHub();
  vi.stubGlobal("fetch", github.fetch);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const route = "GET /repos/example-org/example-repo/activity";
const next = (url: string) => ({ link: `<${url}>; rel="next"` });
const second =
  "https://api.github.com/repos/example-org/example-repo/activity?page=2";

const follow = (keepGoing: (items: readonly number[]) => boolean) => {
  const seen: number[][] = [];
  const done = followPages<number>(
    createClient(token, "github.com", "1.2.3"),
    "GET /repos/{owner}/{repo}/activity",
    { owner: "example-org", repo: "example-repo" },
    (items) => {
      seen.push([...items]);
      return keepGoing(items);
    },
  );
  return settle(done).then(() => seen);
};

describe("followPages", () => {
  it("follows each answer's link to the next page until none is left", async () => {
    github.rest(route, { body: [1, 2], headers: next(second) }, { body: [3] });
    expect(await follow(() => true)).toEqual([[1, 2], [3]]);
    expect(github.sent.map(({ url }) => url.search)).toEqual(["", "?page=2"]);
  });

  it("stops when the visit asks for no more pages", async () => {
    github.rest(route, { body: [1], headers: next(second) });
    expect(await follow(() => false)).toEqual([[1]]);
    expect(github.sent).toHaveLength(1);
  });
});

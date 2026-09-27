import type { People } from "../config/index.js";
import { type Account, classify } from "../people/index.js";
import type { ReviewRequest, Thread } from "./types.js";

/** A review wait's reviewer, and when the wait started. */
export interface ReviewStart {
  /** The requested person's login, or the requested team's name. */
  readonly reviewer: string;
  readonly started: Date;
}

const latest = (instants: readonly Date[]): Date | undefined =>
  instants.reduce<Date | undefined>(
    (found, instant) => (found && found >= instant ? found : instant),
    undefined,
  );

/**
 * Finds a review wait for each reviewer requested on a pull request. A
 * reviewer has one wait, however often they were asked, and it follows the
 * latest request, so two reviewers make two waits.
 *
 * The wait starts at the request. When the reviewer has reviewed since the
 * request, the review stands until the next push: the wait then starts at
 * the latest push after that review, and there is none without such a
 * push. A team's review is given by any of its members.
 *
 * Bots never own a wait and never end one, so a request to a bot makes no
 * wait and a bot's review gives none.
 */
export default function findReviewStarts(
  thread: Thread,
  people: People,
): ReviewStart[] {
  const requests = new Map<string, ReviewRequest>();
  for (const request of thread.reviewRequests) {
    const { reviewer } = request;
    const key = (
      "team" in reviewer ? reviewer.team : reviewer.login
    ).toLowerCase();
    const found = requests.get(key);
    if (!found || found.at < request.at) requests.set(key, request);
  }
  const starts: ReviewStart[] = [];
  for (const { reviewer, at } of requests.values()) {
    if (!("team" in reviewer) && classify(reviewer, people) === "bot") {
      continue;
    }
    const logins = new Set(
      ("team" in reviewer ? reviewer.members : [reviewer.login]).map((login) =>
        login.toLowerCase(),
      ),
    );
    const gives = (author: Account) =>
      logins.has(author.login.toLowerCase()) &&
      classify(author, people) !== "bot";
    const name = "team" in reviewer ? reviewer.team : reviewer.login;
    const reviewed = latest(
      thread.reviews.filter(({ author }) => gives(author)).map(({ at }) => at),
    );
    if (!reviewed || reviewed < at) {
      starts.push({ reviewer: name, started: at });
      continue;
    }
    const pushed = latest(thread.pushes.filter((push) => push > reviewed));
    if (pushed) starts.push({ reviewer: name, started: pushed });
  }
  return starts;
}

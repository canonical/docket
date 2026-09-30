import type { RepoStage } from "../../../cache/index.js";
import { tokens } from "../../../tokens/index.js";
import type { Piece } from "../../types.js";

const plain = tokens["color.text"];
const muted = tokens["color.text.muted"];

/**
 * A repository's stage in words, in the runs its line draws: what it is
 * doing, plain, `reading` alone until its first page says how many
 * there are; `✓` in the success colour before the threads it holds;
 * `waiting` and `paused`, dimmed, as context, with why: `paused: budget
 * low` or `paused: rate limit`; and `✗ failed:` with the reason, in the
 * error colour.
 */
export default function describeStage(stage: RepoStage): Piece[] {
  switch (stage.kind) {
    case "waiting":
      return [{ text: "waiting", fg: muted }];
    case "checking":
      return [{ text: "checking for changes", fg: plain }];
    case "reading":
      // How many pages there are is known only once the first arrives;
      // the page named is the one being read, after those read.
      return [
        {
          text:
            stage.total > 0
              ? `reading page ${Math.min(stage.fetched + 1, stage.total)}/${stage.total}`
              : "reading",
          fg: plain,
        },
      ];
    case "checks":
      return [{ text: "reading checks", fg: plain }];
    case "done":
      return [
        { text: tokens["glyph.succeeded"], fg: tokens["color.text.success"] },
        {
          text: ` ${stage.threads} ${stage.threads === 1 ? "thread" : "threads"}`,
          fg: plain,
        },
      ];
    case "paused":
      return [
        {
          text:
            stage.reason === "rateLimit"
              ? "paused: rate limit"
              : "paused: budget low",
          fg: muted,
        },
      ];
    case "failed":
      return [
        {
          text: `${tokens["glyph.failed"]} failed: ${stage.error.message.replace(/\.$/, "")}`,
          fg: tokens["color.text.error"],
        },
      ];
  }
}

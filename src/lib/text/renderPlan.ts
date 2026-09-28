import { quotedNote } from "./constants.js";
import describeDataAge from "./describeDataAge.js";
import quote from "./quote.js";
import quoteShellWord from "./quoteShellWord.js";
import renderFreshness from "./renderFreshness.js";
import renderJson from "./renderJson.js";
import sanitize from "./sanitize.js";
import type { Format, Freshness } from "./types.js";

/** A write asked for, what stands now, and what GitHub recorded if applied. */
export interface WritePlan {
  /** `assign` sets the assignees; `review` the reviews requested. */
  readonly action: "assign" | "review";
  /** `example#12`. */
  readonly reference: string;
  /** The logins, or `org/team` names, set now. */
  readonly current: readonly string[];
  /** The whole set asked for. */
  readonly wanted: readonly string[];
  /** The set GitHub recorded, once the plan was applied. */
  readonly applied?: readonly string[];
  readonly freshness: Freshness;
  readonly format: Format;
}

const words = {
  assign: { set: "assignees", done: "assigned" },
  review: { set: "reviews requested", done: "requested review" },
} as const;

/** Those of `names` missing from `among`; logins and teams ignore case. */
const listMissing = (names: readonly string[], among: readonly string[]) => {
  const kept = new Set(among.map((name) => name.toLowerCase()));
  return names.filter((name) => !kept.has(name.toLowerCase()));
};

/**
 * Writes a write's plan, or its result. Without `applied`, it lists who
 * would be added, removed and kept, says that nothing has changed, and
 * gives the same command with `--confirm`; with it, it lists what changed
 * and the whole set GitHub now records.
 */
export default function renderPlan(plan: WritePlan): string {
  const { action, reference, freshness, format } = plan;
  const cleanNames = (names: readonly string[]) =>
    names.map((name) => sanitize(name));
  const current = cleanNames(plan.current);
  const wanted = cleanNames(plan.wanted);
  const applied = plan.applied && cleanNames(plan.applied);
  // Once applied, the changes are those GitHub made, which can fall short
  // of those asked for.
  const add = listMissing(applied ?? wanted, current);
  const remove = listMissing(current, applied ?? wanted);
  const keep = listMissing(current, remove);
  const unchanged = add.length === 0 && remove.length === 0;
  const confirm = ["docket", action, reference, ...wanted, "--confirm"]
    .map((word) => quoteShellWord(word))
    .join(" ");
  if (format === "json") {
    const data = {
      action,
      reference,
      data: describeDataAge(freshness),
      add,
      remove,
      keep,
      applied: applied !== undefined,
      result: applied ?? null,
      confirm: applied || unchanged ? null : confirm,
    };
    return renderJson(data);
  }
  const llm = format === "llm";
  const { set, done } = words[action];
  // A login or team name comes from GitHub or from the caller, so an
  // agent reads each one quoted as data.
  const formatNames = (names: readonly string[]) =>
    (llm ? names.map((name) => quote(name)) : names).join(", ");
  const formatList = (names: readonly string[]) => formatNames(names) || "none";
  const title = applied
    ? `${done} ${reference}`
    : `plan · ${action} ${reference}`;
  const verbs = applied
    ? (["added", "removed", "kept"] as const)
    : (["add", "remove", "keep"] as const);
  const changes = [add, remove, keep].flatMap((names, index) =>
    names.length > 0
      ? [`${llm ? "- " : "  "}${verbs.at(index)} ${formatNames(names)}`]
      : [],
  );
  const closing = applied
    ? [`The ${set} of ${reference} are now: ${formatList(applied)}.`]
    : unchanged
      ? [
          `Nothing to change: the ${set} of ${reference} are already: ${formatList(current)}.`,
        ]
      : [
          "Nothing has changed. To apply the plan, run:",
          llm ? `\`${confirm}\`` : `  ${confirm}`,
        ];
  const lines = [
    llm ? `# ${title}` : title,
    ...renderFreshness(freshness, format),
    ...(llm ? [quotedNote] : []),
    "",
    ...(unchanged && !applied ? [] : [...changes, ""]),
    ...closing,
  ];
  return `${lines.join("\n")}\n`;
}

import { describeAddress, type OwedList } from "../owed/index.js";
import { quotedNote } from "./constants.js";
import describeDataAge from "./describeDataAge.js";
import describeWaitData from "./describeWaitData.js";
import renderFreshness from "./renderFreshness.js";
import renderWaitRow from "./renderWaitRow.js";
import sanitize from "./sanitize.js";
import type { Detail, Format, Freshness } from "./types.js";

/** What owed prints: the list, how old its data is, and how to write it. */
export interface OwedAnswer {
  readonly list: OwedList;
  readonly freshness: Freshness;
  readonly format: Format;
  readonly detail: Detail;
}

/**
 * Writes owed: every running wait, most overdue first, in the sections of
 * its grouping. `summary` gives the counts alone.
 *
 * - `plain` is for a person at a terminal: each row on three lines.
 * - `llm` is condensed Markdown for an agent: each row on one complete
 *   line, groupings as headings, times absolute beside relative, and
 *   titles quoted as data.
 * - `json` is for a program.
 */
export default function renderOwed({
  list,
  freshness,
  format,
  detail,
}: OwedAnswer): string {
  const header = describeAddress(list.address);
  const title = [header.title.text, header.address?.text]
    .filter(Boolean)
    .join(" · ");
  const { timezone } = freshness;
  const groups = detail === "summary" ? [] : list.groups;
  if (format === "json") {
    const answer = {
      mode: list.address.mode,
      grouping: list.address.grouping,
      data: describeDataAge(freshness),
      counts: list.counts,
      ...(detail === "summary"
        ? {}
        : {
            groups: groups.map((group) => ({
              heading: group.heading?.text ?? null,
              waits: group.rows.map((row) => describeWaitData(row, detail)),
            })),
          }),
    };
    return `${JSON.stringify(answer, null, 2)}\n`;
  }
  const empty = detail !== "summary" && groups.length === 0;
  const llm = format === "llm";
  const sections = groups.map((group) => {
    const heading = group.heading && sanitize(group.heading.text);
    const rows = group.rows.flatMap((row) =>
      renderWaitRow(row, format, timezone, detail),
    );
    const head = heading ? [llm ? `## ${heading}` : heading] : [];
    return [...head, ...rows].join("\n");
  });
  const lines = [
    llm ? `# ${title}` : title,
    ...renderFreshness(freshness, format),
    ...(llm && sections.length > 0 ? [quotedNote] : []),
    list.summary.text,
    ...(empty ? ["nothing owed"] : []),
  ];
  return `${[lines.join("\n"), ...sections].join("\n\n")}\n`;
}

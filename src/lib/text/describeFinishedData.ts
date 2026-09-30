import type { Closer, Measure, ThreadAddress } from "../endings/index.js";
import type { FinishedRow } from "../finished/index.js";
import { groupWords } from "./constants.js";
import listOwners from "./listOwners.js";
import sanitize from "./sanitize.js";

const describeAddressData = ({ repo, number, url }: ThreadAddress) => ({
  repo: sanitize(repo),
  number,
  url: sanitize(url),
});

function describeCloserData(closer: Closer) {
  switch (closer.kind) {
    case "pullRequest":
      return { kind: closer.kind, ...describeAddressData(closer) };
    case "commit":
      return {
        kind: closer.kind,
        oid: sanitize(closer.oid),
        url: sanitize(closer.url),
      };
    default:
      return { kind: closer.kind };
  }
}

/**
 * A measure as data: how it reads, and once measured its target in
 * working hours, how far past it the wait ended as a share of it, and
 * its verdict.
 */
function describeMeasureData(measure: Measure, targetHours?: number) {
  if (measure.state !== "measured") return { state: measure.state };
  return {
    state: measure.state,
    target: `${targetHours}h`,
    overdue: measure.overdue,
    verdict: measure.verdict,
  };
}

/**
 * One finished thread as data, for a program: the fields activity gives
 * a thread, then its ending as an outcome no provider owns beside the
 * provider's words, when and by whom it ended with that person's group,
 * what closed it and what it duplicates where GitHub records them, when
 * it was opened, whether a label exempts it from time to close, time to
 * close's verdict, and each measure. Times are in ISO 8601.
 */
export default function describeFinishedData(row: FinishedRow) {
  const { thread } = row;
  const { ending } = thread;
  const { closer, duplicateOf } = ending;
  const { actor } = row.ending;
  const owners = row.owner?.text === "unassigned" ? [] : listOwners(row);
  return {
    reference: row.reference.text,
    title: sanitize(row.title.text),
    kind: thread.kind,
    owners,
    draft: row.draft !== undefined,
    stack: thread.stack ?? null,
    invalidRepositoryFile: row.invalidFile !== undefined,
    ending: { outcome: ending.outcome, label: ending.label },
    endedAt: ending.at.toISOString(),
    endedBy: actor
      ? { login: sanitize(actor.text), group: groupWords[actor.group] }
      : null,
    ...(closer ? { closer: describeCloserData(closer) } : {}),
    ...(duplicateOf ? { duplicateOf: describeAddressData(duplicateOf) } : {}),
    openedAt: thread.createdAt.toISOString(),
    exempt: row.measures.close.state === "notApplicable",
    ...(row.verdict ? { verdict: row.verdict } : {}),
    measures: {
      close: describeMeasureData(row.measures.close, row.targetHours),
      firstResponse: describeMeasureData(row.measures.firstResponse),
      firstReview: describeMeasureData(row.measures.firstReview),
    },
  };
}

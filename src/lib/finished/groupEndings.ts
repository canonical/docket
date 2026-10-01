import type { Repo } from "../config/index.js";
import { kindSections } from "../owed/index.js";
import { endingOrder } from "./constants.js";
import type {
  EndingList,
  FinishedAddress,
  FinishedGroup,
  FinishedList,
  FinishedRow,
} from "./types.js";

/**
 * The sections of a grouping, before empty ones are left out. By ending,
 * the sections follow the kinds, then GitHub's order of endings within a
 * kind, each headed by the ending in the provider's words as its rows
 * give them, never in capitals.
 */
function split(
  rows: readonly FinishedRow[],
  grouping: FinishedAddress["grouping"],
  repos: readonly Repo[],
): (readonly [string | undefined, readonly FinishedRow[]])[] {
  switch (grouping) {
    case "none":
      return [[undefined, rows]];
    case "kind":
      return kindSections.map(([kind, text]) => [
        text,
        rows.filter((row) => row.thread.kind === kind),
      ]);
    case "ending":
      return kindSections.flatMap(([kind]) =>
        endingOrder[kind].map((outcome) => {
          const members = rows.filter(
            ({ thread }) =>
              thread.kind === kind && thread.ending.outcome === outcome,
          );
          return [members.at(0)?.ending.action.text, members] as const;
        }),
      );
    default:
      return repos.map(
        ({ name }) => [name, rows.filter((row) => row.repo === name)] as const,
      );
  }
}

/**
 * Splits a gathered list into the sections of an address's grouping. It
 * takes no instant, so changing the grouping reuses the rows as built.
 * The order of the sections is a fixed rule of each grouping: kinds as
 * `ISSUES`, `PULL REQUESTS`, `DISCUSSIONS`; endings within each kind in
 * GitHub's order; repositories in the configuration's order. Rows keep
 * their order inside a section, a section with no rows is left out, and
 * no heading carries a figure.
 *
 * @param repos The watched repositories, in the configuration's order.
 */
export default function groupEndings(
  list: EndingList,
  address: FinishedAddress,
  repos: readonly Repo[],
): FinishedList {
  const { rows, ...figures } = list;
  const groups: FinishedGroup[] = split(rows, address.grouping, repos)
    .filter(([, members]) => members.length > 0)
    .map(([text, members]) =>
      text === undefined
        ? { rows: members }
        : {
            heading: {
              text,
              kind:
                address.grouping === "repo"
                  ? ("identifier" as const)
                  : ("words" as const),
            },
            rows: members,
          },
    );
  const { amount, unit } = address.window;
  return {
    address,
    groups,
    ...figures,
    ...(rows.length === 0
      ? {
          empty: {
            text: `nothing merged or closed in ${amount}${unit}`,
            kind: "words",
          },
        }
      : {}),
  };
}

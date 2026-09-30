import recordTeam from "./recordTeam.js";

/**
 * The team's recording once something changed on each repository: the
 * check for changes answers with a different tag.
 */
export default recordTeam(
  {
    title: "Fix the parser",
    mergedTitle: "Tidy the changelog",
    comment: "Rebased on main.\n\nCould someone look again?",
    label: "kind=bug",
    check: "lint",
    branch: "main",
  },
  "second",
);

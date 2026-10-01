import recordTeam from "./recordTeam.js";

/**
 * The crowded recording once GitHub recorded a change to dave's pull
 * request, the parser fix, and to the pull request #101 like it: the check
 * for changes answers with another tag, and both pull requests carry the
 * later time of their last change.
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
  20,
  "2026-09-30T12:00:30Z",
  [101],
);

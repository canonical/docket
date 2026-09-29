import recordTeam from "./recordTeam.js";

/**
 * The team's recording with twenty more pull requests like dave's, so the
 * list holds more threads than one read of details asks for.
 */
export default recordTeam(
  {
    title: "Fix the parser",
    comment: "Rebased on main.\n\nCould someone look again?",
    label: "kind=bug",
    check: "lint",
    branch: "main",
  },
  "first",
  20,
);

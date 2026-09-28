import recordTeam from "./recordTeam.js";

/** The team's recording, in plain words, before anything changes. */
export default recordTeam({
  title: "Fix the parser",
  comment: "Rebased on main.\n\nCould someone look again?",
  label: "kind=bug",
  check: "lint",
  branch: "main",
});

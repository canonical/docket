/** A personal file that declares every section. */
export const personalFile = `version: 1
repos:
  example: { repo: example-org/example-repo, tags: [core] }
  docs: { repo: example-org/example-docs }
people:
  alice: team
  bob: team
  example-sync: bot
time:
  workdays: [mon, tue, wed, thu, fri]
  timezone: Europe/Paris
targets:
  next-move:
    response: 8h
    review: 1d
  close:
    issue: 20d
    pull-request: 3d
    discussion: 1w
exempt:
  close: ["Topic: roadmap", announcement]
activity: [24h, 1w]
hosts: [github.com]
`;

/** A repository file that declares its team and one target. */
export const repositoryFile = `version: 1
people:
  carol: team
targets:
  close:
    issue: 10d
`;

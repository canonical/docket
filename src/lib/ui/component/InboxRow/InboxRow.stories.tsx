import type { Meta, StoryObj } from "@aztlan/lago-react";
import { notification } from "../../../../testing/inbox.js";
import { longRepo } from "../../../../testing/long.js";
import { drawAtWidth } from "../../../../testing/stories.js";
import type { Repo } from "../../../config/index.js";
import { buildRow } from "../../../inbox/index.js";
import InboxRow from "./InboxRow.js";
import type { InboxRowProps } from "./types.js";

const meta = {
  title: "component/InboxRow",
  component: InboxRow,
  render: drawAtWidth(InboxRow),
} satisfies Meta<typeof InboxRow>;

export default meta;

const repos: Repo[] = [
  { name: "example", repo: "example-org/example-repo", tags: [] },
  { name: "docs", repo: "example-org/example-docs", tags: [] },
];
const now = new Date("2026-09-28T12:00:00Z");
const unread = buildRow(notification(), repos, now);
const read = buildRow(
  notification({
    subject: {
      title: "Crash on start",
      kind: "issue",
      number: 15,
      url: "https://github.com/example-org/example-repo/issues/15",
    },
    reason: "assign",
    unread: false,
  }),
  repos,
  now,
);
const browserOnly = buildRow(
  notification({
    subject: {
      title: "Update dependency example-lib to 2.0",
      kind: "release",
      url: "https://github.com/example-org/example-repo/releases",
    },
    reason: "subscribed",
  }),
  repos,
  now,
);

/** An unread review request on a pull request, selected. */
export const Unread: StoryObj<typeof meta> = {
  args: { row: unread, selected: true, width: 40 },
};

/** A read assignment on an issue, dimmed. */
export const Read: StoryObj<typeof meta> = {
  args: { row: read, width: 40 },
};

/** A release notification, which docket can only send to the browser. */
export const BrowserOnly: StoryObj<typeof meta> = {
  args: { row: browserOnly, width: 40 },
};

/** A notification in a repository and with a title longer than the row holds. */
export const Long: StoryObj<typeof meta> = {
  args: {
    row: buildRow(
      notification({
        repo: longRepo.repo,
        repoUrl:
          "https://github.com/example-org/example-repository-with-a-long-name",
        subject: {
          title:
            "Keep the comments at the ends of lines when the parser meets a heredoc",
          kind: "issue",
          number: 12345,
          url: "https://github.com/example-org/example-repository-with-a-long-name/issues/12345",
        },
        reason: "mention",
      }),
      [longRepo],
      now,
    ),
    width: 40,
  },
};

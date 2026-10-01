import type { Meta, Story } from "../../../../testing/stories.js";
import Notice from "./Notice.js";
import type { NoticeProps } from "./types.js";

const meta: Meta<NoticeProps> = {
  title: "component/Notice",
  component: Notice,
};

export default meta;

/** The GitHub CLI is missing. */
export const GhNotInstalled: Story<NoticeProps> = {
  args: {
    reason: "docket needs the GitHub CLI (gh)",
    recovery: "install it from https://cli.github.com, then run gh auth login",
    width: 40,
  },
};

/** The GitHub CLI is installed but not signed in. */
export const GhNotSignedIn: Story<NoticeProps> = {
  args: {
    reason: "gh is not signed in to github.com",
    recovery: "run gh auth login",
    width: 40,
  },
};

/** A failure no code names stopped docket. */
export const UnexpectedFailure: Story<NoticeProps> = {
  args: {
    reason: "docket stopped on a failure it has no name for: disk on fire",
    recovery: "run the command again; if it keeps failing, report it",
    width: 40,
  },
};

/** GitHub refused a change with a reason longer than the pane. */
export const Long: Story<NoticeProps> = {
  args: {
    reason:
      "GitHub refused the request: Reviews may only be requested from collaborators of example-org/example-repository-with-a-long-name.",
    recovery:
      "change what GitHub's reason names, then close the editor with esc, refresh with R, then open it again with r",
    width: 40,
  },
};

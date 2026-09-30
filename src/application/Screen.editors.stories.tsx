import { recordedWatched, yourTeamSettings } from "../testing/recorded.js";
import {
  connectRecording,
  ScreenFrame,
  type ScreenFrameProps,
  standInGitHub,
  viewRecording,
} from "../testing/screen.js";
import type { Meta, Story } from "../testing/stories.js";

/** The composed screen's editors, which read and write a stand-in for GitHub. */
const meta: Meta<ScreenFrameProps> = {
  title: "application/Screen/editors",
  component: ScreenFrame,
};

export default meta;

/** The recording, its editors on a stand-in for GitHub made anew for each drawing. */
const editable: ScreenFrameProps = {
  ...viewRecording(),
  connect: () => connectRecording({ github: standInGitHub() }),
};

/**
 * `a` on the reply row: the editor under it, alice ticked as GitHub holds
 * her, then the team, the people who wrote on the thread and everyone else
 * GitHub can assign, the cursor on carol, whom only GitHub offers.
 */
export const AssignEditor: Story<ScreenFrameProps> = {
  args: {
    ...editable,
    run: ["thread.assign", "editor.next", "editor.next", "editor.next"],
  },
};

/**
 * `r` on the review row: bob ticked as asked, then whom GitHub suggests,
 * the collaborators and the team, the cursor on the team.
 */
export const RequestReviewEditor: Story<ScreenFrameProps> = {
  args: {
    ...editable,
    run: [
      "selection.next",
      "selection.next",
      "selection.next",
      "selection.next",
      "thread.review",
      "editor.next",
      "editor.next",
      "editor.next",
    ],
  },
};

/**
 * dave ticked beside alice and applied: GitHub cannot assign him and
 * records alice alone, so the editor stays open with the reason and a
 * Recovery line, and the status line says the assignment was refused.
 */
export const AssignRefused: Story<ScreenFrameProps> = {
  args: {
    ...editable,
    run: [
      "thread.assign",
      "editor.next",
      "editor.next",
      "editor.toggle",
      "editor.apply",
    ],
  },
};

/**
 * carol ticked beside alice and applied: the editor closes, the row reads
 * both, and the status line says whom GitHub assigned.
 */
export const AssignSucceeded: Story<ScreenFrameProps> = {
  args: {
    ...editable,
    run: [
      "thread.assign",
      "editor.next",
      "editor.next",
      "editor.next",
      "editor.toggle",
      "editor.apply",
    ],
  },
};

/** The recording, editable, with the personal file naming alice's team. */
const editableYours: ScreenFrameProps = {
  ...editable,
  settings: yourTeamSettings,
  watched: recordedWatched(yourTeamSettings),
  connect: () => ({
    ...connectRecording({ github: standInGitHub() }),
    readWatched: async () => ({ watched: recordedWatched(yourTeamSettings) }),
  }),
};

/** The review picker's steps to its last option, the team. */
const toTheTeam = [
  "selection.next",
  "selection.next",
  "selection.next",
  "selection.next",
  "thread.review",
  "editor.next",
  "editor.next",
  "editor.next",
];

/**
 * `r` on the review row while the personal file names the team as
 * alice's: the team takes her mark, though no thread shows her in it.
 */
export const RequestReviewYourTeam: Story<ScreenFrameProps> = {
  args: { ...editableYours, run: toTheTeam },
};

/**
 * The team ticked beside bob and applied: the status line names it with
 * alice's mark, as the picker did.
 */
export const RequestReviewYourTeamSucceeded: Story<ScreenFrameProps> = {
  args: {
    ...editableYours,
    run: [...toTheTeam, "editor.toggle", "editor.apply"],
  },
};

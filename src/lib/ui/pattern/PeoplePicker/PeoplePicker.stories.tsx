import type { Meta, Story } from "../../../../testing/stories.js";
import PeoplePicker from "./PeoplePicker.js";
import type { PeoplePickerProps } from "./types.js";

const meta: Meta<PeoplePickerProps> = {
  title: "pattern/PeoplePicker",
  component: PeoplePicker,
};

export default meta;

const ignoreTyping = () => {};

/**
 * Assigning: the current assignee ticked, then the team, people in the
 * thread, and someone beyond the team under the cursor.
 */
export const Assigning: Story<PeoplePickerProps> = {
  args: {
    filter: "",
    onFilter: ignoreTyping,
    options: [
      { name: "alice", ticked: true },
      { name: "bob", ticked: false },
      { name: "dave", ticked: false },
      { name: "designer-example", ticked: false },
    ],
    cursor: 3,
    width: 40,
  },
};

/** Requesting review: the current request, a suggestion, collaborators and a team. */
export const RequestingReview: Story<PeoplePickerProps> = {
  args: {
    filter: "",
    onFilter: ignoreTyping,
    options: [
      { name: "bob", ticked: true },
      { name: "carol", ticked: false },
      { name: "alice", ticked: false },
      { name: "dave", ticked: false },
      { name: "example-org/reviewers", ticked: false },
    ],
    cursor: 4,
    width: 40,
  },
};

/** GitHub refused the change: the reason and a recovery under the options. */
export const Refused: Story<PeoplePickerProps> = {
  args: {
    filter: "",
    onFilter: ignoreTyping,
    options: [
      { name: "alice", ticked: false },
      { name: "designer-example", ticked: true },
    ],
    cursor: 1,
    notice: {
      reason:
        "GitHub refused: designer-example is not a collaborator on example",
      recovery:
        "ask an example admin to add designer-example, then apply again",
    },
    width: 40,
  },
};

/** The candidates are still being read from GitHub. */
export const Loading: Story<PeoplePickerProps> = {
  args: {
    filter: "ca",
    onFilter: ignoreTyping,
    cursor: 0,
    width: 40,
  },
};

/** More people than the picker draws at once, the cursor far down. */
export const Scrolled: Story<PeoplePickerProps> = {
  args: {
    filter: "",
    onFilter: ignoreTyping,
    options: Array.from({ length: 9 }, (_, place) => ({
      name: `person-${place + 1}`,
      ticked: place === 0,
    })),
    cursor: 6,
    width: 40,
  },
};

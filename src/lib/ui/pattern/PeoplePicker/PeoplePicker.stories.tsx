import type { Meta, Story } from "../../../../testing/stories.js";
import type { PersonGroup } from "../../../owed/index.js";
import PeoplePicker from "./PeoplePicker.js";
import type { PeoplePickerProps } from "./types.js";

const meta: Meta<PeoplePickerProps> = {
  title: "pattern/PeoplePicker",
  component: PeoplePicker,
};

export default meta;

const ignoreTyping = () => {};

/** A login or team the picker offers, with its group. */
const person = (text: string, group: PersonGroup) => ({
  text,
  kind: "person" as const,
  group,
});

/**
 * Assigning: the current assignee ticked, then the team, people in the
 * thread, and someone beyond the team under the cursor.
 */
export const Assigning: Story<PeoplePickerProps> = {
  args: {
    filter: "",
    onFilter: ignoreTyping,
    options: [
      { owner: person("alice", "you"), ticked: true },
      { owner: person("bob", "team"), ticked: false },
      { owner: person("dave", "outside"), ticked: false },
      { owner: person("designer-example", "internal"), ticked: false },
    ],
    cursor: 3,
    width: 40,
  },
};

/**
 * Requesting review: the current request, a suggestion, a team the viewer
 * belongs to, a collaborator and another team of the organisation.
 */
export const RequestingReview: Story<PeoplePickerProps> = {
  args: {
    filter: "",
    onFilter: ignoreTyping,
    options: [
      { owner: person("bob", "team"), ticked: true },
      { owner: person("carol", "internal"), ticked: false },
      { owner: person("example-org/ui", "you"), ticked: false },
      { owner: person("dave", "outside"), ticked: false },
      {
        owner: person("example-org/reviewers", "internal"),
        ticked: false,
      },
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
      { owner: person("alice", "you"), ticked: false },
      { owner: person("designer-example", "internal"), ticked: true },
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
      owner: person(`person-${place + 1}`, "outside"),
      ticked: place === 0,
    })),
    cursor: 6,
    width: 40,
  },
};

/** Requesting review from a login and a team longer than the pane. */
export const Long: Story<PeoplePickerProps> = {
  args: {
    filter: "",
    onFilter: ignoreTyping,
    options: [
      {
        owner: person(
          "example-contributor-with-a-long-login-past-the-pane",
          "outside",
        ),
        ticked: true,
      },
      {
        owner: person(
          "example-org/a-team-with-a-very-long-name-past-the-pane",
          "internal",
        ),
        ticked: false,
      },
    ],
    cursor: 1,
    width: 40,
  },
};

import type { Meta, StoryObj } from "@aztlan/lago-react";
import { drawAtWidth } from "../../../../testing/stories.js";
import Loading from "./Loading.js";
import type { LoadingProps } from "./types.js";

const meta = {
  title: "component/Loading",
  component: Loading,
  render: drawAtWidth(Loading),
} satisfies Meta<typeof Loading>;

export default meta;

/** A windowed mode while the cache reads its window. */
export const Reading: StoryObj<typeof meta> = {
  args: {
    label: { text: "refresh in progress…", kind: "words" },
    width: 38,
  },
};

/** The longest line the list area gives a read that is under way. */
export const Long: StoryObj<typeof meta> = {
  args: {
    label: { text: "refresh in progress…", kind: "words" },
    width: 38,
  },
};

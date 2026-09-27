/**
 * The shape of a story file, after Component Story Format: the file's
 * default export names the component, and each named export is one story
 * with the props it is drawn with. OpenTUI draws to a terminal rather than
 * a page, so the stories are drawn by the tests through OpenTUI's test
 * renderer.
 */

import type { ReactNode } from "react";

/** A story file's default export: its title and the component it draws. */
export interface Meta<Props> {
  readonly title: string;
  readonly component: (props: Props) => ReactNode;
}

/** One story: the props the component is drawn with. */
export interface Story<Props> {
  readonly args: Props;
}

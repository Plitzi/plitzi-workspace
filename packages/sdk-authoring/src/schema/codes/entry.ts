export type AuthoringCodeEntry = {
  /**
   * Refused stops the space from being written; warned writes it, and says it will not do what it says; suggested is
   * not a problem at all — the page renders as written, and a shorter way to the same page exists.
   */
  kind: 'refused' | 'warned' | 'suggested';
  /** What was wrong, in a line. */
  means: string;
  /** What to write instead. */
  fix: string;
  /**
   * Why only `authorSpace` can say it — what it reads that the documents do not hold. Every other code is said of the
   * documents alone, so the builder and the MCP, which read nothing else, say what authoring says.
   */
  authoringOnly?: string;
};

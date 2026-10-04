/** The anchor someone probably meant: the same words, in the form an anchor takes (`ANCHOR_PATTERN`). */
export const asAnchor = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^[^a-z]+|-+$/g, '') || 'section';

import { useFontHead } from '@plitzi/sdk-shared/hooks';

import type { FontHead } from '@plitzi/sdk-shared';

export type FontFacesProps = {
  /** What the space's manifest resolves to — `fontsToHead(style.fonts, ...)`. */
  head: FontHead;
};

/**
 * The space's web fonts, in the document, for a render that has no server to have put them there.
 *
 * A component rather than a call inside `Sdk` because the render modes decide who needs it: everything that paints
 * into THIS document, shadow included — where a `@font-face` would be ignored — and not the iframe, whose head is
 * fed through the asset rail instead.
 */
const FontFaces = ({ head }: FontFacesProps) => {
  useFontHead(head);

  return null;
};

export default FontFaces;

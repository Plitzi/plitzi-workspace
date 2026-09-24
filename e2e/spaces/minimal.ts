import { authorSpace, heading, paragraph, singlePageSpace } from '@plitzi/sdk-authoring';

import type { AuthoredSpace, CssSpec } from '@plitzi/sdk-authoring';

/** The smallest thing that is still a space: one page, one heading, one paragraph.
 *
 *  Its reason to exist is isolation. When a spec is about ONE thing — a style rule, a binding, an element type —
 *  rendering thirty elements around it means a failure has thirty possible causes. This has two. */

export type MinimalSpaceOptions = {
  heading?: string;
  body?: string;
  /** The heading's own rules, so a spec can put the exact rule it is testing on the page. */
  headingCss?: CssSpec;
};

export const MINIMAL_IDS = { page: 'minimal-page', heading: 'minimal-heading', body: 'minimal-body' };

export const minimalSpace = ({
  heading: title = 'Minimal space',
  body = 'One page, two elements.',
  headingCss
}: MinimalSpaceOptions = {}): AuthoredSpace =>
  authorSpace(
    singlePageSpace(
      [
        heading(title, { id: MINIMAL_IDS.heading, subType: 'h1', ...(headingCss ? { css: headingCss } : {}) }),
        paragraph(body, { id: MINIMAL_IDS.body })
      ],
      { name: 'minimal', permanentUrl: 'minimal', page: { id: MINIMAL_IDS.page } }
    )
  );

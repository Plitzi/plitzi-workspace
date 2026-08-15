import type { Element, OfflineDataRaw } from '@plitzi/sdk-shared';

/** The smallest thing that is still a space: one page, one heading, one paragraph.
 *
 *  Its reason to exist is isolation. When a spec is about ONE thing — a style rule, a binding, an element type —
 *  rendering thirty elements around it means a failure has thirty possible causes. This has two. */

export type MinimalSpaceOptions = {
  heading?: string;
  body?: string;
  /** Appended to the space's style cache, so a spec can put the exact rule it is testing on the page. */
  css?: string;
};

const PAGE_ID = 'minimal-page';
const HEADING_ID = 'minimal-heading';
const BODY_ID = 'minimal-body';

export const MINIMAL_IDS = { page: PAGE_ID, heading: HEADING_ID, body: BODY_ID };

/** Every element carries a class of its own, so a spec can write one CSS rule and assert it landed. Without a
 *  style selector there is nothing on the page for a stylesheet to target. */
const element = (id: string, type: string, attributes: Record<string, unknown>, extra: object = {}): Element => ({
  id,
  attributes,
  definition: {
    label: type,
    type,
    rootId: PAGE_ID,
    parentId: PAGE_ID,
    styleSelectors: { base: id },
    initialState: { visibility: true },
    ...extra
  }
});

export const minimalSpace = ({
  heading = 'Minimal space',
  body = 'One page, two elements.',
  css = ''
}: MinimalSpaceOptions = {}): OfflineDataRaw =>
  ({
    schema: {
      definition: { name: 'minimal', permanentUrl: '' },
      variables: [],
      settings: { customCss: '' },
      pages: [PAGE_ID],
      pageFolders: {},
      flat: {
        [PAGE_ID]: element(
          PAGE_ID,
          'page',
          { slug: '', default: true, name: 'Home' },
          { parentId: null, items: [HEADING_ID, BODY_ID] }
        ),
        [HEADING_ID]: element(HEADING_ID, 'heading', { subType: 'h1', content: heading }),
        [BODY_ID]: element(BODY_ID, 'paragraph', { content: body })
      }
    },
    style: { cache: css }
  }) as unknown as OfflineDataRaw;

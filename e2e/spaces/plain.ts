import type { Element, OfflineDataRaw } from '@plitzi/sdk-shared';

/** A whole page built from element types the SDK ships, and nothing else.
 *
 *  The sample space the examples render carries three RSC elements whose components a deployment has to provide.
 *  That is the right thing for an example about RSC and the wrong thing for everything else: anywhere those
 *  components are absent the space renders "Component Server Info Not Found" in place of them — noise in a
 *  screenshot, and a spec that has to know which absences are expected.
 *
 *  This one has no such dependency. It renders identically in the harness, on a server, and inside the builder,
 *  which is what makes it the default for anything whose subject is not RSC. */

const PAGE = 'plain-page';

export const PLAIN_IDS = {
  page: PAGE,
  title: 'plain-title',
  intro: 'plain-intro',
  cards: 'plain-cards',
  firstCard: 'plain-card-1',
  firstCardTitle: 'plain-card-1-title',
  logo: 'plain-logo'
};

const el = (id: string, type: string, attributes: Record<string, unknown>, definition: object = {}): Element => ({
  id,
  attributes,
  definition: {
    label: type,
    type,
    rootId: PAGE,
    parentId: PAGE,
    styleSelectors: { base: id },
    initialState: { visibility: true },
    ...definition
  }
});

const card = (index: number, title: string, body: string): Record<string, Element> => {
  const id = `plain-card-${index}`;

  return {
    [id]: el(id, 'container', {}, { parentId: PLAIN_IDS.cards, items: [`${id}-title`, `${id}-body`] }),
    [`${id}-title`]: el(`${id}-title`, 'heading', { subType: 'h2', content: title }, { parentId: id }),
    [`${id}-body`]: el(`${id}-body`, 'paragraph', { content: body }, { parentId: id })
  };
};

const CSS = `
.${PAGE}{display:flex;flex-direction:column;gap:24px;padding:48px;font-family:system-ui,sans-serif;background:#ffffff;color:#17171c;min-height:100vh;}
.${PLAIN_IDS.title}{font-size:40px;font-weight:800;margin:0;}
.${PLAIN_IDS.cards}{display:flex;gap:24px;flex-wrap:wrap;}
.plain-card-1,.plain-card-2,.plain-card-3{flex:1 1 240px;border:1px solid #d4d4d8;border-radius:12px;padding:20px;}
.${PLAIN_IDS.logo}{width:64px;height:64px;}
`;

export type PlainSpaceOptions = {
  title?: string;
  intro?: string;
  /** Appended to the space stylesheet, for a spec testing one rule. */
  css?: string;
};

export const plainSpace = ({
  title = 'A plain space',
  intro = 'Every element here is one the SDK ships.',
  css = ''
}: PlainSpaceOptions = {}): OfflineDataRaw =>
  ({
    schema: {
      definition: { name: 'plain', permanentUrl: '' },
      variables: [],
      settings: { customCss: '' },
      pages: [PAGE],
      pageFolders: {},
      flat: {
        [PAGE]: el(
          PAGE,
          'page',
          { slug: '', default: true, name: 'Home' },
          {
            parentId: undefined,
            items: [PLAIN_IDS.logo, PLAIN_IDS.title, PLAIN_IDS.intro, PLAIN_IDS.cards]
          }
        ),
        // A data URI rather than a URL: nothing to fetch, so it loads the same with or without a network.
        [PLAIN_IDS.logo]: el(PLAIN_IDS.logo, 'image', {
          src:
            'data:image/svg+xml;charset=utf-8,' +
            encodeURIComponent(
              '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><circle cx="32" cy="32" r="30" fill="%235c3df5"/></svg>'
            ),
          alt: 'Logo'
        }),
        [PLAIN_IDS.title]: el(PLAIN_IDS.title, 'heading', { subType: 'h1', content: title }),
        [PLAIN_IDS.intro]: el(PLAIN_IDS.intro, 'paragraph', { content: intro }),
        [PLAIN_IDS.cards]: el(
          PLAIN_IDS.cards,
          'container',
          {},
          { items: ['plain-card-1', 'plain-card-2', 'plain-card-3'] }
        ),
        ...card(1, 'Docs', 'Find in-depth information.'),
        ...card(2, 'Learn', 'Take the interactive course.'),
        ...card(3, 'Templates', 'Explore the playground.')
      }
    },
    style: { cache: `${CSS}${css}` }
  }) as unknown as OfflineDataRaw;

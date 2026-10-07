import { container, heading, link, paragraph } from './elements';

import type { Suggestion } from './schema/advice';
import type { PageSpec, SpaceSpec } from './schema/types';

/** The slug of the page an address no other page answers gets: sent with status 404. */
export const NOT_FOUND_SLUG = '*';

const NOT_FOUND_ID = 'plitzi-not-found';

/**
 * The page a space that declares none of its own answers an unknown address with — inside the home page's layout, so
 * a visitor who mistyped a link is still on the site: what was asked for is not here, and the way home.
 */
const defaultNotFoundPage = (home: PageSpec | undefined): PageSpec => ({
  id: NOT_FOUND_ID,
  name: 'Not found',
  slug: NOT_FOUND_SLUG,
  seoTitle: 'Page not found',
  ...(home?.layout ? { layout: home.layout } : {}),
  body: [
    container({
      id: `${NOT_FOUND_ID}-body`,
      css: {
        display: 'flex',
        'flex-direction': 'column',
        'align-items': 'center',
        'row-gap': '16px',
        padding: '96px 24px',
        'text-align': 'center'
      },
      children: [
        heading('Page not found', { id: `${NOT_FOUND_ID}-title`, subType: 'h1' }),
        paragraph({ id: `${NOT_FOUND_ID}-text`, content: 'There is nothing at this address.' }),
        link({ id: `${NOT_FOUND_ID}-home`, href: '/', content: 'Back to the home page' })
      ]
    })
  ]
});

const isTopLevelNotFound = (page: PageSpec): boolean => page.slug === NOT_FOUND_SLUG && !page.folder;

/**
 * The space with a page for the addresses no page answers: its own, or — when it declares none — a plain one, said as a
 * suggestion so the author knows it is there and how to write theirs. A space that is not a list of pages yet is left
 * as it is, for authoring to refuse.
 */
export const withNotFoundPage = (spec: SpaceSpec): { spec: SpaceSpec; added?: Suggestion } => {
  if (!Array.isArray(spec.pages) || spec.pages.length === 0 || spec.pages.some(isTopLevelNotFound)) {
    return { spec };
  }

  const home = spec.pages.find(page => page.slug === '' && !page.folder);
  const page = defaultNotFoundPage(home);

  return {
    spec: { ...spec, pages: [...spec.pages, page] },
    added: {
      code: 'not-found-page',
      message: `No page answers an address nothing else does, so a plain one was added${home?.layout ? ` in the layout "${home.layout.id}"` : ''}, sent with status 404: write your own — a page whose slug is '*' — to say it in the space's words.`,
      elementIds: [NOT_FOUND_ID],
      saves: 0
    }
  };
};

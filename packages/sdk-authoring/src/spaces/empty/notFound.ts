import { heading, link, paragraph } from '../../elements';

import type { PageSpec } from '../../schema';

/** The page of every address no other page answers, sent with status 404: what was asked for is not here, and the way back. */
export const notFound: PageSpec = {
  id: 'not-found',
  name: 'Not found',
  slug: '*',
  layout: { id: 'site', slot: 'site-main' },
  body: [
    heading('Page not found', { id: 'not-found-title', subType: 'h1' }),
    paragraph({ id: 'not-found-lede', content: 'There is nothing at this address.' }),
    link({ id: 'not-found-home', href: '/', content: 'Back to the home page' })
  ]
};

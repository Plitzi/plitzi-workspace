import { bodyText, button, heroBand, kicker, sectionTitle, shell } from './theme.ts';
import { container, heading, link, paragraph, text } from '../../elements';

import type { PageSpec } from '../../schema';

/** The page of every address no other page answers, sent with status 404: what was asked for is not here, and the way back. */
export const notFound: PageSpec = {
  id: 'not-found',
  name: 'Not found',
  slug: '*',
  body: [
    container({
      id: 'not-found-main',
      subType: 'main',
      class: [shell, heroBand],
      children: [
        text('404', { id: 'not-found-kicker', class: kicker }),
        heading('Page not found', { id: 'not-found-title', subType: 'h1', class: sectionTitle }),
        paragraph({
          id: 'not-found-lede',
          class: bodyText,
          content: 'There is nothing at this address — it may have moved, or the link has a typo.'
        }),
        link({ id: 'not-found-home', href: '/', class: button, content: 'Back to the home page' })
      ]
    })
  ]
};

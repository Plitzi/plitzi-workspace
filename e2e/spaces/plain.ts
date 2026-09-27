import { authorSpace, container, heading, image, paragraph, singlePageSpace, styles } from '@plitzi/sdk-authoring';

import type { AuthoredSpace } from '@plitzi/sdk-authoring';

/** A whole page built from element types the SDK ships, and nothing else.
 *
 *  The sample space the examples render carries three RSC elements whose components a deployment has to provide.
 *  That is the right thing for an example about RSC and the wrong thing for everything else: anywhere those
 *  components are absent the space renders "Component Server Info Not Found" in place of them — noise in a
 *  screenshot, and a spec that has to know which absences are expected.
 *
 *  This one has no such dependency. It renders identically in the harness, on a server, and inside the builder,
 *  which is what makes it the default for anything whose subject is not RSC. */

export const PLAIN_IDS = {
  page: 'plain-page',
  title: 'plain-title',
  intro: 'plain-intro',
  cards: 'plain-cards',
  firstCard: 'plain-card-1',
  firstCardTitle: 'plain-card-1-title',
  logo: 'plain-logo'
};

const card = styles('plain-card', {
  flex: '1 1 240px',
  border: '1px solid #d4d4d8',
  'border-radius': '12px',
  padding: '20px'
});

const cardOf = (index: number, title: string, body: string) =>
  container({
    id: `plain-card-${index}`,
    class: card,
    children: [heading(title, { id: `plain-card-${index}-title`, subType: 'h2' }), paragraph(body)]
  });

export type PlainSpaceOptions = {
  title?: string;
  intro?: string;
};

// A data URI rather than a URL: nothing to fetch, so it loads the same with or without a network.
const LOGO =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><circle cx="32" cy="32" r="30" fill="#5c3df5"/></svg>'
  );

export const plainSpace = ({
  title = 'A plain space',
  intro = 'Every element here is one the SDK ships.'
}: PlainSpaceOptions = {}): AuthoredSpace =>
  authorSpace(
    singlePageSpace(
      [
        image({ id: PLAIN_IDS.logo, src: LOGO, alt: 'Logo', css: { width: '64px', height: '64px' } }),
        heading(title, {
          id: PLAIN_IDS.title,
          subType: 'h1',
          css: { 'font-size': '40px', 'font-weight': '800', margin: '0' }
        }),
        paragraph(intro, { id: PLAIN_IDS.intro }),
        container({
          id: PLAIN_IDS.cards,
          css: { display: 'flex', gap: '24px', 'flex-wrap': 'wrap' },
          children: [
            cardOf(1, 'Docs', 'Find in-depth information.'),
            cardOf(2, 'Learn', 'Take the interactive course.'),
            cardOf(3, 'Templates', 'Explore the playground.')
          ]
        })
      ],
      {
        name: 'plain',
        permanentUrl: 'plain',
        page: {
          id: PLAIN_IDS.page,
          css: {
            display: 'flex',
            'flex-direction': 'column',
            gap: '24px',
            padding: '48px',
            'font-family': 'system-ui, sans-serif',
            'background-color': '#ffffff',
            color: '#17171c',
            'min-height': '100vh'
          }
        }
      }
    )
  );

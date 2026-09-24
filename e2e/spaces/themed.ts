import { authorSpace, heading, singlePageSpace, themeToggle } from '@plitzi/sdk-authoring';

import type { AuthoredSpace } from '@plitzi/sdk-authoring';

/** A page that paints entirely from its palette, and a switch that changes which palette that is.
 *
 *  The smallest space in which "the theme changed" is something a browser can MEASURE. The page's background is
 *  `var(--background)` and nothing else, so its computed colour is the palette the SDK really put in force — not the
 *  class that was written, which is the half that kept working while every colour stayed where it was. The palette
 *  is a space variable like any real space's, so the selectors under test are the ones production emits. */

export const THEMED_IDS = { page: 'themed-page', heading: 'themed-heading', toggle: 'themed-toggle' };

/** Both sides of the palette as a browser reports them back, so a spec compares computed values directly. */
export const THEMED_BACKGROUND = { light: 'rgb(255, 255, 255)', dark: 'rgb(11, 11, 15)' };

export const themedSpace = (): AuthoredSpace =>
  authorSpace(
    singlePageSpace(
      [
        heading('Themed space', { id: THEMED_IDS.heading, subType: 'h1' }),
        themeToggle({ id: THEMED_IDS.toggle, subType: 'switch' })
      ],
      {
        name: 'themed',
        permanentUrl: 'themed',
        variables: {
          color: {
            background: { light: '#ffffff', dark: '#0b0b0f', default: '#ffffff' },
            foreground: { light: '#17171c', dark: '#f4f4f5', default: '#17171c' }
          }
        },
        page: {
          id: THEMED_IDS.page,
          css: {
            'min-height': '100vh',
            padding: '48px',
            'background-color': 'var(--background)',
            color: 'var(--foreground)'
          }
        }
      }
    )
  );

import { styleVariablesToCss } from '@plitzi/sdk-variables/VariablesHelper';

import type { Element, OfflineDataRaw, StyleVariables } from '@plitzi/sdk-shared';

/** A page that paints entirely from its palette, and a switch that changes which palette that is.
 *
 *  The smallest space in which "the theme changed" is something a browser can MEASURE. The page's background is
 *  `var(--background)` and nothing else, so its computed colour is the palette the SDK really put in force — not the
 *  class that was written, which is the half that kept working while every colour stayed where it was. The palette
 *  goes through the same `styleVariablesToCss` a real space's does, so the selectors under test are the ones
 *  production emits. */

const PAGE = 'themed-page';

export const THEMED_IDS = { page: PAGE, heading: 'themed-heading', toggle: 'themed-toggle' };

/** Both sides of the palette as a browser reports them back, so a spec compares computed values directly. */
export const THEMED_BACKGROUND = { light: 'rgb(255, 255, 255)', dark: 'rgb(11, 11, 15)' };

// The authored shape of a palette is looser than the stored `StyleVariables` record, the same way a space's own is.
const palette = {
  color: {
    background: { light: '#ffffff', dark: '#0b0b0f', default: '#ffffff' },
    foreground: { light: '#17171c', dark: '#f4f4f5', default: '#17171c' }
  }
} as unknown as Partial<StyleVariables>;

const CSS = `.${PAGE}{min-height:100vh;padding:48px;background-color:var(--background);color:var(--foreground);}`;

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

export const themedSpace = (): OfflineDataRaw =>
  ({
    schema: {
      definition: { name: 'themed', permanentUrl: '' },
      variables: [],
      settings: { customCss: '' },
      pages: [PAGE],
      pageFolders: {},
      flat: {
        [PAGE]: el(
          PAGE,
          'page',
          { slug: '', default: true, name: 'Home' },
          { parentId: null, items: [THEMED_IDS.heading, THEMED_IDS.toggle] }
        ),
        [THEMED_IDS.heading]: el(THEMED_IDS.heading, 'heading', { subType: 'h1', content: 'Themed space' }),
        [THEMED_IDS.toggle]: el(THEMED_IDS.toggle, 'themeToggle', { subType: 'switch' })
      }
    },
    style: { cache: `${styleVariablesToCss(palette)}\n${CSS}` }
  }) as unknown as OfflineDataRaw;

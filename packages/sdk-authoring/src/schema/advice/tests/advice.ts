import { button, container, text } from '../../../elements';
import { onClick } from '../../../elements/steps';
import { setState } from '../../../interactions';
import { authorSpace } from '../../space';

import type { ElementSpec, PageSpec, SpaceSpec } from '../../types';

export const page = (id: string, body: ElementSpec[]): PageSpec => ({
  id,
  name: id,
  slug: id === 'home' ? '' : id,
  body
});

export const space = (pages: PageSpec[], extra: Partial<SpaceSpec> = {}): SpaceSpec => ({
  name: 'Advice',
  permanentUrl: 'advice',
  classes: {
    top: { display: 'flex' },
    brand: {},
    nav: {},
    navOn: { color: 'red' },
    navOff: {},
    card: {},
    card2: {},
    menu: {},
    'menu-button': {},
    'menu-label': {},
    'menu-hint': {},
    tile: {},
    'tile-label': {},
    'tile-value': {},
    'tile-note': {},
    panel: {},
    includes: {},
    tick: {},
    line: {}
  },
  pages,
  ...extra
});

export const codesOf = (spec: SpaceSpec): string[] => authorSpace(spec).suggestions.map(suggestion => suggestion.code);

// Three filter menus a helper writes: alike, side by side, each reading its own options and keeping its own choice.
export const menu = (key: string) =>
  container({
    class: 'menu',
    children: [
      button({
        class: 'menu-button',
        content: key,
        flows: [[onClick(), setState({ key, type: 'text', value: 'open' })]]
      }),
      text({ class: 'menu-label', bind: { content: `state.${key}` } }),
      text({ class: 'menu-hint', content: 'Pick one' })
    ]
  });

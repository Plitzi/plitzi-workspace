import { describe, expect, it } from 'vitest';

import { container, text } from '../elements';
import { authorSpace } from '../index';
import { styles, toBlocks } from '../style';

import type { SpaceSpec } from './types';

const card = styles('card', { css: { padding: '16px' } });
const sidebar = styles('sidebar', { css: { width: '240px' } });
const icon = styles('card-icon', {
  css: { transition: 'transform 180ms' },
  ancestors: {
    [card.name]: { states: { hover: { transform: 'translateX(3px)' } } },
    [sidebar.name]: { variants: { collapsed: { display: 'none' } } }
  }
});

const spaceWith = (spec: Partial<SpaceSpec>): SpaceSpec => ({
  name: 'Ancestors',
  permanentUrl: 'ancestors',
  pages: [
    {
      id: 'home',
      name: 'Home',
      slug: '',
      body: [container({ class: sidebar, children: [container({ class: card, children: [text('→', { class: icon })] })] })]
    }
  ],
  ...spec
});

describe('ancestor conditions', () => {
  it('expands the rules under an ancestor like any other, per breakpoint', () => {
    const blocks = toBlocks({
      ancestors: {
        card: { states: { hover: { padding: '4px' } }, variants: { open: { mobile: { gap: '2px' } } } }
      }
    });

    expect(blocks.desktop?.ancestors?.card.states?.hover).toEqual({
      'padding-top': '4px',
      'padding-right': '4px',
      'padding-bottom': '4px',
      'padding-left': '4px'
    });
    expect(blocks.mobile?.ancestors?.card.variants?.open.default).toEqual({ 'row-gap': '2px', 'column-gap': '2px' });
  });

  it('writes them into the class and its compiled rule', () => {
    const { style } = authorSpace(spaceWith({}));
    const item = style.platform.desktop['card-icon'];

    expect(item.attributes.base.ancestors?.card.states?.hover).toEqual({ transform: 'translateX(3px)' });
    expect(item.cache).toContain(':where(.card:hover) &{transform:translateX(3px);}');
    expect(item.cache).toContain(':where(.sidebar[data-variant="collapsed"],.sidebar--collapsed) &{display:none;}');
  });

  it('refuses an ancestor the space does not declare', () => {
    const lost = styles('lost-icon', { ancestors: { crad: { states: { hover: { color: 'red' } } } } });

    expect(() =>
      authorSpace(
        spaceWith({
          pages: [{ id: 'home', name: 'Home', slug: '', body: [container({ class: card, children: [text('x', { class: lost })] })] }]
        })
      )
    ).toThrow(/names the class "crad", which this space does not declare/);
  });

  it('refuses a key that is not a class name', () => {
    expect(() => styles('bad', { ancestors: { '.card:hover': { states: { hover: { color: 'red' } } } } })).toThrow(
      /The ancestor ".card:hover" is not a class name/
    );
  });

  it('can be given to an element type too', () => {
    const { style } = authorSpace(
      spaceWith({ elements: { text: { ancestors: { card: { states: { hover: { color: 'red' } } } } } } })
    );

    expect(style.platform.desktop.text.cache).toContain(':where(.card:hover) &{color:red;}');
  });
});

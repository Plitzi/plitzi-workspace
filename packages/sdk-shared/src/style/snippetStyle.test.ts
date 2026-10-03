import { describe, expect, it } from 'vitest';

import { mergeSnippetStyle, sameSelector } from './snippetStyle';

import type { Style, StyleItem } from '../types';

const rule = (name: string, padding: string, cache = `.${name}{padding:${padding}}`): StyleItem => ({
  name,
  type: 'class',
  attributes: { base: { default: { 'padding-top': padding } } },
  cache
});

const desktop = (items: Record<string, StyleItem>): Style['platform'] => ({ desktop: items, tablet: {}, mobile: {} });

describe('mergeSnippetStyle', () => {
  it('adds the rules the space lacks and keeps every one it has', () => {
    const space = { platform: desktop({ card: rule('card', '8px') }) };
    const merged = mergeSnippetStyle(space, {
      platform: desktop({ card: rule('card', '24px'), badge: rule('badge', '2px') })
    });

    expect(merged.platform.desktop).toEqual({ card: rule('card', '8px'), badge: rule('badge', '2px') });
    expect(space.platform.desktop).toEqual({ card: rule('card', '8px') });
  });

  it('adds the tokens the space lacks, and never recolours one it reads', () => {
    const merged = mergeSnippetStyle(
      { platform: desktop({}), variables: { color: { accent: 'blue' } } },
      { platform: desktop({}), variables: { color: { accent: 'red', muted: '#999' }, spacing: { gap: '8px' } } }
    );

    expect(merged.variables).toEqual({ color: { accent: 'blue', muted: '#999' }, spacing: { gap: '8px' } });
  });
});

describe('sameSelector', () => {
  it('reads two rules as the same when only their compiled CSS differs', () => {
    expect(
      sameSelector('card', desktop({ card: rule('card', '8px', 'a') }), desktop({ card: rule('card', '8px', 'b') }))
    ).toBe(true);
  });

  it('tells apart rules that say something else, or say it in other display modes', () => {
    expect(sameSelector('card', desktop({ card: rule('card', '8px') }), desktop({ card: rule('card', '9px') }))).toBe(
      false
    );
    expect(
      sameSelector('card', desktop({ card: rule('card', '8px') }), {
        ...desktop({ card: rule('card', '8px') }),
        mobile: { card: rule('card', '8px') }
      })
    ).toBe(false);
  });
});

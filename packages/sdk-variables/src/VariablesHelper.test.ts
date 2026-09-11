import { describe, expect, it } from 'vitest';

import { styleVariablesToCss } from './VariablesHelper';

import type { StyleVariables } from '@plitzi/sdk-shared';

const palette = {
  color: {
    background: { light: '#fff', dark: '#000', default: '#fff' },
    accent: { light: '#eee' }
  }
} as unknown as Partial<StyleVariables>;

const css = (name?: string) => styleVariablesToCss(palette, name).replace(/\s+/gu, ' ');

describe('styleVariablesToCss', () => {
  it('writes the default on the root and each scheme behind its media query', () => {
    const out = css();

    expect(out).toContain(':root { --background: #fff; }');
    expect(out).toContain('@media (prefers-color-scheme: light) { :root:not(.dark)');
    expect(out).toContain('@media (prefers-color-scheme: dark) { :root:not(.light)');
  });

  /**
   * The half that was missing, and it is why a themed container did nothing.
   *
   * `:root.dark` matches the document element and nothing else, so a host that themes a space by putting the class
   * on the SDK's own container — the desktop window, an embedded component — had a palette no switch could reach:
   * the store flipped, the class landed, and every colour stayed where it was.
   */
  it('lets the class land anywhere, not only on the document element', () => {
    const out = css();

    expect(out).toContain(':root.dark, .dark {');
    expect(out).toContain(':root.light, .light {');
  });

  /** The chosen class is written after the media queries, so at equal specificity the choice wins. */
  it('puts the choice last', () => {
    const out = css();

    expect(out.indexOf(':root.dark, .dark {')).toBeGreaterThan(out.indexOf('@media (prefers-color-scheme: dark)'));
  });

  /** A scoped palette is already inside something: the class goes in front of it, not on it. */
  it('scopes a named selector under the class rather than beside it', () => {
    const out = css('.widget');

    expect(out).toContain('.dark .widget {');
    expect(out).toContain(':root:not(.light) .widget');
  });

  /** A value with only one side must not blank out the other: `undefined` is a token a custom property accepts. */
  it('writes only the sides it was given', () => {
    const out = css();

    expect(out).not.toContain('undefined');
    expect(out).toContain('--accent: #eee;');
  });
});

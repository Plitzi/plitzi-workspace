import { describe, expect, it } from 'vitest';

import { StyleVariableCategory } from '@plitzi/sdk-shared/types';

import { createBaseStyle, paramsBase } from './StyleMap/tests/StyleMap';
import StyleReducer, { StyleActions } from './StyleReducer';

import type { SpaceFont, Style } from '@plitzi/sdk-shared';

const styleOf = (overrides: Partial<Style> = {}): Style => ({
  ...createBaseStyle(),
  theme: { default: 'light', schemes: ['light', 'dark'] },
  cache: '',
  ...overrides
});

const font = (family: string): SpaceFont => ({ family, source: 'system' }) as SpaceFont;

describe('StyleReducer', () => {
  it('merges an update into the style', () => {
    const state = StyleReducer(styleOf(), { type: StyleActions.STYLE_UPDATE, style: { mode: 'mobile-first' } });

    expect(state.mode).toBe('mobile-first');
    expect(state.platform).toEqual(createBaseStyle().platform);
  });

  it('adds a selector, compiles it into the cache, and leaves the state it was given as it was', () => {
    const before = styleOf();
    const after = StyleReducer(before, {
      type: StyleActions.STYLE_ADD_SELECTOR,
      displayMode: 'desktop',
      selector: 'btn',
      selectorType: 'class',
      value: { color: 'red' },
      params: paramsBase
    });

    expect(after.platform.desktop.btn.attributes.base.default?.color).toBe('red');
    expect(after.cache).toContain('red');
    expect(before.platform.desktop.btn).toBeUndefined();
  });

  it('updates and removes a selector, the cache following each', () => {
    const added = StyleReducer(styleOf(), {
      type: StyleActions.STYLE_ADD_SELECTOR,
      displayMode: 'desktop',
      selector: 'btn',
      selectorType: 'class',
      value: { color: 'red' },
      params: paramsBase
    });
    const updated = StyleReducer(added, {
      type: StyleActions.STYLE_UPDATE_SELECTOR,
      displayMode: 'desktop',
      selector: 'btn',
      value: { color: 'blue' },
      params: paramsBase
    });

    expect(updated.cache).toContain('blue');
    expect(updated.cache).not.toContain('red');

    const removed = StyleReducer(updated, {
      type: StyleActions.STYLE_REMOVE_SELECTOR,
      displayMode: 'desktop',
      selector: 'btn'
    });

    expect(removed.platform.desktop.btn).toBeUndefined();
    expect(removed.cache).not.toContain('blue');
  });

  it('removes several selectors at once, and changes nothing for selectors it does not have', () => {
    const add = (state: Style, selector: string) =>
      StyleReducer(state, {
        type: StyleActions.STYLE_ADD_SELECTOR,
        displayMode: 'desktop',
        selector,
        selectorType: 'class',
        value: { color: 'red' },
        params: paramsBase
      });
    const both = add(add(styleOf(), 'a'), 'b');
    const neither = StyleReducer(both, {
      type: StyleActions.STYLE_REMOVE_SELECTORS,
      displayMode: 'desktop',
      selectors: ['x']
    });

    expect(neither).toBe(both);

    const removed = StyleReducer(both, {
      type: StyleActions.STYLE_REMOVE_SELECTORS,
      displayMode: 'desktop',
      selectors: ['a', 'b', 'x']
    });

    expect(Object.keys(removed.platform.desktop)).toEqual([]);
  });

  it('adds, updates and removes a variable, written into the cache', () => {
    const added = StyleReducer(styleOf(), {
      type: StyleActions.STYLE_ADD_VARIABLE,
      category: StyleVariableCategory.COLOR,
      name: 'brand',
      value: { light: '#123456', dark: '#654321', default: '#123456' }
    });

    expect(added.variables.color?.brand).toBeDefined();
    expect(added.cache).toContain('--brand');

    const updated = StyleReducer(added, {
      type: StyleActions.STYLE_UPDATE_VARIABLE,
      category: StyleVariableCategory.COLOR,
      name: 'brand',
      value: { light: '#abcdef', dark: '#fedcba', default: '#abcdef' }
    });

    expect(updated.cache).toContain('#abcdef');

    const removed = StyleReducer(updated, {
      type: StyleActions.STYLE_REMOVE_VARIABLE,
      category: StyleVariableCategory.COLOR,
      name: 'brand'
    });

    expect(removed.cache).not.toContain('--brand');
  });

  it("adds, updates and removes a selector's own variable", () => {
    const withSelector = StyleReducer(styleOf(), {
      type: StyleActions.STYLE_ADD_SELECTOR,
      displayMode: 'desktop',
      selector: 'card',
      selectorType: 'class',
      value: { color: 'red' },
      params: paramsBase
    });
    const added = StyleReducer(withSelector, {
      type: StyleActions.STYLE_ADD_SELECTOR_VARIABLE,
      displayMode: 'desktop',
      selector: 'card',
      category: StyleVariableCategory.COLOR,
      name: 'tint',
      value: { light: '#111111', dark: '#111111', default: '#111111' }
    });

    expect(added.cache).toContain('--tint');

    const updated = StyleReducer(added, {
      type: StyleActions.STYLE_UPDATE_SELECTOR_VARIABLE,
      displayMode: 'desktop',
      selector: 'card',
      category: StyleVariableCategory.COLOR,
      name: 'tint',
      value: { light: '#222222', dark: '#222222', default: '#222222' }
    });

    expect(updated.cache).toContain('#222222');

    const removed = StyleReducer(updated, {
      type: StyleActions.STYLE_REMOVE_SELECTOR_VARIABLE,
      displayMode: 'desktop',
      selector: 'card',
      category: StyleVariableCategory.COLOR,
      name: 'tint'
    });

    expect(removed.cache).not.toContain('--tint');
  });

  // Declaring or dropping a family changes where a face comes from, never the compiled stylesheet.
  it('adds, updates and removes a font without recompiling the stylesheet', () => {
    const state = styleOf({ cache: 'compiled' });
    const added = StyleReducer(state, { type: StyleActions.STYLE_ADD_FONT, font: font('Geist') });

    expect(added.fonts?.map(item => item.family)).toEqual(['Geist']);
    expect(added.cache).toBe('compiled');

    const updated = StyleReducer(added, { type: StyleActions.STYLE_UPDATE_FONT, family: 'Geist', font: font('Inter') });

    expect(updated.fonts?.map(item => item.family)).toEqual(['Inter']);

    const removed = StyleReducer(updated, { type: StyleActions.STYLE_REMOVE_FONT, family: 'Inter' });

    expect(removed.fonts).toEqual([]);
  });

  it("adds a snippet's rules and tokens beside what the space has, keeping its own", () => {
    const state = styleOf({
      variables: { color: { brand: { light: '#000000', dark: '#ffffff', default: '#000000' } } }
    });
    const added = StyleReducer(state, {
      type: StyleActions.STYLE_ADD_SNIPPET,
      style: {
        platform: {
          desktop: {
            hero: {
              name: 'hero',
              type: 'class',
              attributes: { base: { default: { color: 'gold' } } },
              cache: '.hero{color:gold;}'
            }
          }
        },
        variables: {
          color: {
            brand: { light: '#999999', dark: '#999999', default: '#999999' },
            accent: { light: '#ff0000', dark: '#ff0000', default: '#ff0000' }
          }
        }
      } as never
    });

    expect(added.platform.desktop.hero).toBeDefined();
    expect(added.variables.color?.brand).toEqual({ light: '#000000', dark: '#ffffff', default: '#000000' });
    expect(added.variables.color?.accent).toBeDefined();
    expect(added.cache).toContain('gold');
  });

  it('sets the mode, and no other setting', () => {
    expect(
      StyleReducer(styleOf(), { type: StyleActions.STYLE_UPDATE_SETTINGS, path: 'mode', value: 'mobile-first' }).mode
    ).toBe('mobile-first');
    const state = styleOf();

    expect(StyleReducer(state, { type: StyleActions.STYLE_UPDATE_SETTINGS, path: 'cache', value: 'x' }).cache).toBe('');
  });
});

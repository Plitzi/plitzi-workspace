import { describe, it, expect, beforeEach } from 'vitest';

import { StyleVariableCategory } from '@plitzi/sdk-shared';

import StyleMap from './StyleMap';

import type { Style, StyleItem } from '@plitzi/sdk-shared';
import type { StylePlatform } from '@plitzi/sdk-shared';

const createBaseStyle = (): Pick<Style, 'platform' | 'variables'> => ({
  platform: {
    desktop: {},
    tablet: {},
    mobile: {}
  },
  variables: {}
});

describe('StyleMap', () => {
  let style: Pick<Style, 'platform' | 'variables'>;

  beforeEach(() => {
    style = createBaseStyle();
  });

  describe('addSelector (default)', () => {
    it('adds without path (object)', () => {
      const ok = StyleMap.addSelector(
        style,
        'desktop',
        'btn',
        'class',
        undefined,
        { color: 'red' },
        { componentType: '' }
      );
      expect(ok).toBe(true);
      expect(style.platform.desktop.btn.attributes.color).toBe('red');
    });

    it('adds with path (value)', () => {
      const ok = StyleMap.addSelector(style, 'desktop', 'btn2', 'class', 'color', 'blue', { componentType: '' });
      expect(ok).toBe(true);
      expect(style.platform.desktop.btn2.attributes.color).toBe('blue');
    });

    it('rejects object when path is string', () => {
      const ok = StyleMap.addSelector(style, 'desktop', 'x', 'class', 'color', { color: 'red' }, { componentType: '' });
      expect(ok).toBe(false);
      expect(style.platform.desktop.x).toBeUndefined();
    });

    it('rejects deep path', () => {
      // @ts-expect-error // eslint-disable-line
      const ok = StyleMap.addSelector(style, 'desktop', 'y', 'class', 'a.b', { a: { b: 'c' } });
      expect(ok).toBe(false);
      expect(style.platform.desktop.y).toBeUndefined();
    });

    it('prevents duplicates', () => {
      StyleMap.addSelector(style, 'desktop', 'dup', 'class', undefined, {}, { componentType: '' });
      const ok = StyleMap.addSelector(style, 'desktop', 'dup', 'class', undefined, {}, { componentType: '' });
      expect(ok).toBe(false);
    });

    it('allows same selector name in different displayModes', () => {
      StyleMap.addSelector(style, 'desktop', 'shared', 'class', undefined, {}, { componentType: '' });
      const ok = StyleMap.addSelector(style, 'mobile', 'shared', 'class', undefined, {}, { componentType: '' });
      expect(ok).toBe(true);
    });

    it('creates empty attributes when value is undefined and no path', () => {
      const ok = StyleMap.addSelector(style, 'desktop', 'undef', 'class', undefined, undefined, { componentType: '' });
      expect(ok).toBe(true);
      expect(style.platform.desktop.undef.attributes).toEqual({});
    });
  });

  describe('addSelector (element)', () => {
    it('requires params', () => {
      const ok = StyleMap.addSelector(style, 'desktop', 'card', 'element', undefined, {}, { componentType: '' });
      expect(ok).toBe(false);
      expect(style.platform.desktop.card).toBeUndefined();
    });

    it('adds with attributes object', () => {
      const ok = StyleMap.addSelector(
        style,
        'desktop',
        'card',
        'element',
        undefined,
        { base: { color: 'red' } },
        { componentType: 'button' }
      );

      expect(ok).toBe(true);
      const item = style.platform.desktop.card as Extract<StyleItem, { type: 'element' }>;
      expect(item.attributes.base.color).toBe('red');
    });

    it('adds with path value', () => {
      const ok = StyleMap.addSelector(style, 'desktop', 'card2', 'element', 'color', 'blue', {
        styleSelector: 'base',
        componentType: 'button'
      });

      expect(ok).toBe(true);
      expect(style.platform.desktop.card2).toBeDefined();
    });

    it('fails when componentType is empty', () => {
      const ok = StyleMap.addSelector(style, 'desktop', 'card3', 'element', undefined, {}, { componentType: '' });
      expect(ok).toBe(false);
      expect(style.platform.desktop.card3).toBeUndefined();
    });

    it('fails when adding duplicate selector', () => {
      StyleMap.addSelector(style, 'desktop', 'dupCard', 'element', undefined, {}, { componentType: 'button' });
      const ok = StyleMap.addSelector(
        style,
        'desktop',
        'dupCard',
        'element',
        undefined,
        {},
        { componentType: 'button' }
      );
      expect(ok).toBe(false);
    });

    it('allows same selector across displayModes', () => {
      StyleMap.addSelector(style, 'desktop', 'cardX', 'element', undefined, {}, { componentType: 'button' });
      const ok = StyleMap.addSelector(style, 'mobile', 'cardX', 'element', undefined, {}, { componentType: 'button' });
      expect(ok).toBe(true);
    });

    it('creates nested structure when using path', () => {
      StyleMap.addSelector(style, 'desktop', 'cardNested', 'element', 'color', 'red', {
        styleSelector: 'base',
        componentType: 'button'
      });

      const item = style.platform.desktop.cardNested as Extract<StyleItem, { type: 'element' }>;
      expect(item.attributes.base.color).toBe('red');
    });
  });

  describe('getSelector', () => {
    it('returns selector', () => {
      StyleMap.addSelector(style, 'desktop', 'btn', 'class', undefined, {}, { componentType: '' });
      const res = StyleMap.getSelector(style, 'desktop', 'btn');
      expect(res?.name).toBe('btn');
    });

    it('returns undefined when missing', () => {
      expect(StyleMap.getSelector(style, 'desktop', 'nope')).toBeUndefined();
    });
  });

  describe('updateSelector', () => {
    beforeEach(() => {
      StyleMap.addSelector(style, 'desktop', 'btn', 'class', undefined, {}, { componentType: '' });
    });

    it('updates value with path', () => {
      const ok = StyleMap.updateSelector(style, 'desktop', 'btn', 'class', 'color', 'red');
      expect(ok).toBe(true);
      expect(style.platform.desktop.btn.attributes.color).toBe('red');
    });

    it('removes value when undefined', () => {
      StyleMap.updateSelector(style, 'desktop', 'btn', 'class', 'color', 'red');
      StyleMap.updateSelector(style, 'desktop', 'btn', 'class', 'color');
      expect(style.platform.desktop.btn.attributes.color).toBeUndefined();
    });

    it('fails when selector missing', () => {
      const ok = StyleMap.updateSelector(style, 'desktop', 'nope', 'class', 'color', 'red');
      expect(ok).toBe(false);

      const ok2 = StyleMap.updateSelector(style, 'desktop', 'ghost', 'class', 'color', 'red');
      expect(ok2).toBe(false);
      expect(style.platform.desktop.ghost).toBeUndefined();
    });

    it('fails on deep path (default)', () => {
      // @ts-expect-error // eslint-disable-line
      const ok = StyleMap.updateSelector(style, 'desktop', 'btn', 'class', 'a.b', 'red');
      expect(ok).toBe(false);
    });

    it('replaces entire attributes when no path', () => {
      const ok = StyleMap.updateSelector(style, 'desktop', 'btn', 'class', undefined, { color: 'green' });
      expect(ok).toBe(true);
      expect(style.platform.desktop.btn.attributes).toEqual({ color: 'green' });
    });

    it('element dont allows deep path update', () => {
      StyleMap.addSelector(style, 'desktop', 'card', 'element', undefined, {}, { componentType: 'button' });

      // @ts-expect-error // eslint-disable-line
      const ok1 = StyleMap.updateSelector(style, 'desktop', 'card', 'element', 'a.b', 'red');

      // @ts-expect-error // eslint-disable-line
      const ok2 = StyleMap.updateSelector(style, 'desktop', 'btn', 'class', 'a.b', 'red');

      expect(ok1).toBe(false);
      expect(ok2).toBe(false);
    });
  });

  describe('removeSelector', () => {
    it('removes from one mode', () => {
      StyleMap.addSelector(style, 'desktop', 'btn', 'class', undefined, {}, { componentType: '' });
      const ok = StyleMap.removeSelector(style, 'desktop', 'btn');
      expect(ok).toBe(true);
      expect(style.platform.desktop.btn).toBeUndefined();
    });

    it('removes from all modes', () => {
      StyleMap.addSelector(style, 'desktop', 'btn', 'class', undefined, {}, { componentType: '' });
      StyleMap.addSelector(style, 'mobile', 'btn', 'class', undefined, {}, { componentType: '' });
      const ok = StyleMap.removeSelector(style, undefined, 'btn');
      expect(ok).toBe(true);
      expect(style.platform.desktop.btn).toBeUndefined();
      expect(style.platform.mobile.btn).toBeUndefined();
    });

    it('returns false if not found', () => {
      expect(StyleMap.removeSelector(style, 'desktop', 'nope')).toBe(false);
    });
  });

  describe('selector variables', () => {
    beforeEach(() => {
      StyleMap.addSelector(style, 'desktop', 'btn', 'class', undefined, {}, { componentType: '' });
    });

    it('adds variable', () => {
      const ok = StyleMap.addSelectorVariable(style, 'desktop', 'btn', StyleVariableCategory.COLOR, 'primary', '#000');
      expect(ok).toBe(true);
      expect(style.platform.desktop.btn.variables?.color?.primary).toBe('#000');
    });

    it('prevents duplicate', () => {
      StyleMap.addSelectorVariable(style, 'desktop', 'btn', StyleVariableCategory.COLOR, 'primary', '#000');
      const ok = StyleMap.addSelectorVariable(style, 'desktop', 'btn', StyleVariableCategory.COLOR, 'primary', '#111');
      expect(ok).toBe(false);
    });

    it('updates variable', () => {
      StyleMap.addSelectorVariable(style, 'desktop', 'btn', StyleVariableCategory.COLOR, 'primary', '#000');
      StyleMap.updateSelectorVariable(style, 'desktop', 'btn', StyleVariableCategory.COLOR, 'primary', '#111');
      expect(style.platform.desktop.btn.variables?.color?.primary).toBe('#111');
    });

    it('removes variable and cleans up', () => {
      StyleMap.addSelectorVariable(style, 'desktop', 'btn', StyleVariableCategory.COLOR, 'primary', '#000');
      StyleMap.removeSelectorVariable(style, 'desktop', 'btn', StyleVariableCategory.COLOR, 'primary');
      expect(style.platform.desktop.btn.variables).toBeUndefined();
    });

    it('fails removing missing variable', () => {
      const ok = StyleMap.removeSelectorVariable(style, 'desktop', 'btn', StyleVariableCategory.COLOR, 'nope');
      expect(ok).toBe(false);
    });

    it('fails when selector does not exist', () => {
      const ok = StyleMap.addSelectorVariable(style, 'desktop', 'nope', StyleVariableCategory.COLOR, 'x', '#000');
      expect(ok).toBe(false);
    });

    it('updateSelectorVariable creates variable if not exists', () => {
      const ok = StyleMap.updateSelectorVariable(
        style,
        'desktop',
        'btn',
        StyleVariableCategory.COLOR,
        'newVar',
        '#123'
      );
      expect(ok).toBe(true);
      expect(style.platform.desktop.btn.variables?.color?.newVar).toBe('#123');
    });

    it('removeSelectorVariable only removes target key', () => {
      StyleMap.addSelectorVariable(style, 'desktop', 'btn', StyleVariableCategory.COLOR, 'a', '#000');
      StyleMap.addSelectorVariable(style, 'desktop', 'btn', StyleVariableCategory.COLOR, 'b', '#111');

      StyleMap.removeSelectorVariable(style, 'desktop', 'btn', StyleVariableCategory.COLOR, 'a');

      expect(style.platform.desktop.btn.variables?.color?.a).toBeUndefined();
      expect(style.platform.desktop.btn.variables?.color?.b).toBe('#111');
    });
  });

  describe('global variables', () => {
    it('adds variable', () => {
      const ok = StyleMap.addVariable(style, StyleVariableCategory.COLOR, 'primary', '#000');
      expect(ok).toBe(true);
      expect(style.variables.color?.primary).toBe('#000');
    });

    it('prevents duplicate', () => {
      StyleMap.addVariable(style, StyleVariableCategory.COLOR, 'primary', '#000');
      const ok = StyleMap.addVariable(style, StyleVariableCategory.COLOR, 'primary', '#111');
      expect(ok).toBe(false);
    });

    it('updates variable', () => {
      StyleMap.addVariable(style, StyleVariableCategory.COLOR, 'primary', '#000');
      StyleMap.updateVariable(style, StyleVariableCategory.COLOR, 'primary', '#111');
      expect(style.variables.color?.primary).toBe('#111');
    });

    it('fails update when missing', () => {
      const ok = StyleMap.updateVariable(style, StyleVariableCategory.COLOR, 'nope', '#000');
      expect(ok).toBe(false);
    });

    it('removes variable and cleans up', () => {
      StyleMap.addVariable(style, StyleVariableCategory.COLOR, 'primary', '#000');
      StyleMap.removeVariable(style, StyleVariableCategory.COLOR, 'primary');
      expect(style.variables.color).toBeUndefined();
    });

    it('fails removing missing', () => {
      const ok = StyleMap.removeVariable(style, StyleVariableCategory.COLOR, 'nope');
      expect(ok).toBe(false);
    });

    it('creates category lazily', () => {
      StyleMap.addVariable(style, StyleVariableCategory.COLOR, 'primary', '#000');
      expect(style.variables.color).toBeDefined();
    });

    it('does not overwrite existing category object', () => {
      StyleMap.addVariable(style, StyleVariableCategory.COLOR, 'a', '#000');
      StyleMap.addVariable(style, StyleVariableCategory.COLOR, 'b', '#111');

      expect(Object.keys(style.variables.color ?? {})).toHaveLength(2);
    });
  });

  describe('edge cases', () => {
    it('does not crash with empty platform', () => {
      const empty = { platform: {} as StylePlatform, variables: {} };
      expect(() => StyleMap.getSelector(empty, 'desktop', 'btn')).not.toThrow();
    });

    it('regenerates cache on updates', () => {
      StyleMap.addSelector(style, 'desktop', 'btn', 'class', undefined, {}, { componentType: '' });
      const before = style.platform.desktop.btn.cache;
      StyleMap.updateSelector(style, 'desktop', 'btn', 'class', 'color', 'red');
      const after = style.platform.desktop.btn.cache;
      expect(after).not.toBe(before);
    });

    it('removeSelector returns false when none found (all modes)', () => {
      const ok = StyleMap.removeSelector(style, undefined, 'nope');
      expect(ok).toBe(false);
    });

    it('updateSelector does nothing when both path and value missing', () => {
      StyleMap.addSelector(style, 'desktop', 'btn', 'class', undefined, {}, { componentType: '' });
      const before = { ...style.platform.desktop.btn.attributes };

      const ok = StyleMap.updateSelector(style, 'desktop', 'btn', 'class');

      expect(ok).toBe(true);
      expect(style.platform.desktop.btn.attributes).toEqual(before);
    });

    it('element update does not supports deep path', () => {
      StyleMap.addSelector(style, 'desktop', 'card', 'element', undefined, {}, { componentType: 'button' });

      // @ts-expect-error // eslint-disable-line
      const ok = StyleMap.updateSelector(style, 'desktop', 'card', 'element', 'base.color', 'red');
      expect(ok).toBe(false);
    });

    it('element allows undefined value with path (structure still created)', () => {
      const ok = StyleMap.addSelector(style, 'desktop', 'cardZ', 'element', 'color', undefined, {
        styleSelector: 'base',
        componentType: 'button'
      });

      expect(ok).toBe(true);
      expect(style.platform.desktop.cardZ).toBeDefined();
    });
  });
});

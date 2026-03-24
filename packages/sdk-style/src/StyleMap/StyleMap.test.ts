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

const paramsGeneric = { componentType: 'button' };

describe('StyleMap', () => {
  let style: Pick<Style, 'platform' | 'variables'>;

  beforeEach(() => {
    style = createBaseStyle();
  });

  // 1. addSelector (default)
  describe('addSelector (default)', () => {
    it('adds selector as object and does not overwrite on duplicate', () => {
      expect(StyleMap.addSelector(style, 'desktop', 'btn', 'class', undefined, { color: 'red' }, paramsGeneric)).toBe(
        true
      );
      expect(style.platform.desktop.btn.attributes.color).toBe('red');
      expect(StyleMap.addSelector(style, 'desktop', 'btn', 'class', undefined, { color: 'blue' }, paramsGeneric)).toBe(
        false
      );
      expect(style.platform.desktop.btn.attributes.color).toBe('red');
    });

    it('adds selector with path as string and prevents duplicate/overwrite', () => {
      expect(StyleMap.addSelector(style, 'desktop', 'btn2', 'class', 'color', 'blue', paramsGeneric)).toBe(true);
      expect(style.platform.desktop.btn2.attributes.color).toBe('blue');
      expect(StyleMap.addSelector(style, 'desktop', 'btn2', 'class', 'color', 'red', paramsGeneric)).toBe(false);
      expect(style.platform.desktop.btn2.attributes.color).toBe('blue');
    });

    it('adds selector with undefined value and does not overwrite on duplicate', () => {
      expect(StyleMap.addSelector(style, 'desktop', 'undef', 'class', undefined, undefined, paramsGeneric)).toBe(true);
      expect(style.platform.desktop.undef.attributes).toEqual({});
      expect(StyleMap.addSelector(style, 'desktop', 'undef', 'class', undefined, undefined, paramsGeneric)).toBe(false);
      expect(style.platform.desktop.undef.attributes).toEqual({});
    });

    it('allows same selector name across displayModes and prevents duplicate in same mode', () => {
      expect(StyleMap.addSelector(style, 'desktop', 'shared', 'class', undefined, {}, paramsGeneric)).toBe(true);
      expect(StyleMap.addSelector(style, 'desktop', 'shared', 'class', undefined, {}, paramsGeneric)).toBe(false);
      expect(StyleMap.addSelector(style, 'mobile', 'shared', 'class', undefined, {}, paramsGeneric)).toBe(true);
      expect(StyleMap.addSelector(style, 'mobile', 'shared', 'class', undefined, {}, paramsGeneric)).toBe(false);
    });

    it('rejects object value when path is string', () => {
      expect(StyleMap.addSelector(style, 'desktop', 'x', 'class', 'color', { color: 'red' }, paramsGeneric)).toBe(
        false
      );
      expect(style.platform.desktop.x).toBeUndefined();
    });

    it('rejects deep path in selector', () => {
      // @ts-expect-error // eslint-disable-line
      expect(StyleMap.addSelector(style, 'desktop', 'y', 'class', 'a.b', { a: { b: 'c' } }, paramsGeneric)).toBe(false);
      expect(style.platform.desktop.y).toBeUndefined();
    });

    it('prevents duplicate selectors with same name in same mode', () => {
      StyleMap.addSelector(style, 'desktop', 'dup', 'class', undefined, {}, paramsGeneric);
      expect(StyleMap.addSelector(style, 'desktop', 'dup', 'class', undefined, {}, paramsGeneric)).toBe(false);
    });

    it('adds selector with state, with and without path, and prevents duplicate for state', () => {
      expect(
        StyleMap.addSelector(
          style,
          'desktop',
          'btnState',
          'class',
          undefined,
          { color: 'red' },
          { ...paramsGeneric, state: 'hover' }
        )
      ).toBe(true);
      const item = style.platform.desktop.btnState as Exclude<StyleItem, { type: 'element' }>;
      expect(item.stateAttributes?.hover?.color).toBe('red');
      expect(
        StyleMap.addSelector(
          style,
          'desktop',
          'btnState',
          'class',
          undefined,
          { color: 'blue' },
          { ...paramsGeneric, state: 'hover' }
        )
      ).toBe(false);
      expect(item.stateAttributes?.hover?.color).toBe('red');

      expect(
        StyleMap.addSelector(style, 'desktop', 'btnState2', 'class', 'color', 'blue', {
          ...paramsGeneric,
          state: 'focus'
        })
      ).toBe(true);
      const item2 = style.platform.desktop.btnState2 as Exclude<StyleItem, { type: 'element' }>;
      expect(item2.stateAttributes?.focus?.color).toBe('blue');
      expect(
        StyleMap.addSelector(style, 'desktop', 'btnState2', 'class', 'color', 'red', {
          ...paramsGeneric,
          state: 'focus'
        })
      ).toBe(false);
      expect(item2.stateAttributes?.focus?.color).toBe('blue');
    });
  });

  // 2. addSelector (element)
  describe('addSelector (element)', () => {
    it('fails to add element selector when params are missing or value is primitive', () => {
      // @ts-expect-error // eslint-disable-line
      expect(StyleMap.addSelector(style, 'desktop', 'card', 'element', undefined, {}, undefined)).toBe(false);
      expect(style.platform.desktop.card).toBeUndefined();
      expect(StyleMap.addSelector(style, 'desktop', 'badPrimitive', 'element', undefined, 'red', paramsGeneric)).toBe(
        false
      );
      expect(style.platform.desktop.badPrimitive).toBeUndefined();
    });

    it('adds element selector with attributes object, prevents duplicate, and supports nested structure', () => {
      expect(
        StyleMap.addSelector(style, 'desktop', 'card', 'element', undefined, { base: { color: 'red' } }, paramsGeneric)
      ).toBe(true);
      const item = style.platform.desktop.card as Extract<StyleItem, { type: 'element' }>;
      expect(item.attributes.base.color).toBe('red');
      expect(
        StyleMap.addSelector(style, 'desktop', 'card', 'element', undefined, { base: { color: 'blue' } }, paramsGeneric)
      ).toBe(false);
      expect(item.attributes.base.color).toBe('red');
    });

    it('adds element selector with multiple attributes and prevents duplicate', () => {
      expect(
        StyleMap.addSelector(
          style,
          'desktop',
          'card2',
          'element',
          undefined,
          { base: { color: 'red' }, selectorA: { color: 'blue' } },
          paramsGeneric
        )
      ).toBe(true);
      const item2 = style.platform.desktop.card2 as Extract<StyleItem, { type: 'element' }>;
      expect(item2.attributes.base.color).toBe('red');
      expect(item2.attributes.selectorA.color).toBe('blue');
      expect(
        StyleMap.addSelector(
          style,
          'desktop',
          'card2',
          'element',
          undefined,
          { base: { color: 'green' } },
          paramsGeneric
        )
      ).toBe(false);
      expect(item2.attributes.base.color).toBe('red');
      expect(item2.attributes.selectorA.color).toBe('blue');
    });

    it('does not allow adding element selector with path and styleSelector if already exists', () => {
      StyleMap.addSelector(
        style,
        'desktop',
        'card2',
        'element',
        undefined,
        { base: { color: 'red' }, selectorA: { color: 'blue' } },
        paramsGeneric
      );
      expect(
        StyleMap.addSelector(style, 'desktop', 'card2', 'element', 'color', 'blue', {
          ...paramsGeneric,
          styleSelector: 'base'
        })
      ).toBe(false);
      expect(style.platform.desktop.card2).toBeDefined();
      expect(
        StyleMap.addSelector(style, 'desktop', 'card2', 'element', 'color', 'red', {
          ...paramsGeneric,
          styleSelector: 'base'
        })
      ).toBe(false);
    });

    it('adds element selector with path and styleSelector if not already present, prevents duplicate', () => {
      StyleMap.addSelector(style, 'desktop', 'cardNested', 'element', 'color', 'red', {
        ...paramsGeneric,
        styleSelector: 'base'
      });
      const item3 = style.platform.desktop.cardNested as Extract<StyleItem, { type: 'element' }>;
      expect(item3.attributes.base.color).toBe('red');
      expect(
        StyleMap.addSelector(style, 'desktop', 'cardNested', 'element', 'color', 'blue', {
          ...paramsGeneric,
          styleSelector: 'base'
        })
      ).toBe(false);
      expect(item3.attributes.base.color).toBe('red');
    });

    it('fails to add element selector when componentType is empty', () => {
      expect(
        StyleMap.addSelector(
          style,
          'desktop',
          'card3',
          'element',
          undefined,
          {},
          { ...paramsGeneric, componentType: '' }
        )
      ).toBe(false);
      expect(style.platform.desktop.card3).toBeUndefined();
    });

    it('prevents duplicate element selectors and allows same selector across displayModes', () => {
      StyleMap.addSelector(style, 'desktop', 'dupCard', 'element', undefined, {}, paramsGeneric);
      expect(StyleMap.addSelector(style, 'desktop', 'dupCard', 'element', undefined, {}, paramsGeneric)).toBe(false);
      StyleMap.addSelector(style, 'desktop', 'cardX', 'element', undefined, {}, paramsGeneric);
      expect(StyleMap.addSelector(style, 'mobile', 'cardX', 'element', undefined, {}, paramsGeneric)).toBe(true);
    });

    it('adds element selector with state, path, and styleSelector, and prevents duplicate for state', () => {
      expect(
        StyleMap.addSelector(
          style,
          'desktop',
          'cardState',
          'element',
          undefined,
          { base: { color: 'red' } },
          { ...paramsGeneric, state: 'hover' }
        )
      ).toBe(true);
      const item = style.platform.desktop.cardState as Extract<StyleItem, { type: 'element' }>;
      expect(item.stateAttributes?.base.hover?.color).toBe('red');
      expect(
        StyleMap.addSelector(
          style,
          'desktop',
          'cardState',
          'element',
          undefined,
          { color: 'red' },
          { ...paramsGeneric, styleSelector: 'base', state: 'hover' }
        )
      ).toBe(false);
      expect(item.stateAttributes?.base.hover?.color).toBe('red');
      expect(
        StyleMap.addSelector(style, 'desktop', 'cardState2', 'element', 'color', 'blue', {
          ...paramsGeneric,
          styleSelector: 'base',
          state: 'focus'
        })
      ).toBe(true);
      const item2 = style.platform.desktop.cardState2 as Extract<StyleItem, { type: 'element' }>;
      expect(item2.stateAttributes?.base.focus?.color).toBe('blue');
    });
  });

  // 3. getSelector
  describe('getSelector', () => {
    it('returns selector if present and undefined if missing', () => {
      StyleMap.addSelector(style, 'desktop', 'btn', 'class', undefined, {}, { componentType: '' });
      const res = StyleMap.getSelector(style, 'desktop', 'btn');
      expect(res?.name).toBe('btn');
      expect(StyleMap.getSelector(style, 'desktop', 'nope')).toBeUndefined();
    });
  });

  // 4. updateSelector (default)
  describe('updateSelector (default)', () => {
    beforeEach(() => {
      StyleMap.addSelector(style, 'desktop', 'btn', 'class', undefined, {}, { componentType: '' });
    });

    it('updates value with path, removes value with path, and replaces attributes object', () => {
      expect(StyleMap.updateSelector(style, 'desktop', 'btn', 'class', 'color', 'red', { componentType: '' })).toBe(
        true
      );
      expect(style.platform.desktop.btn.attributes.color).toBe('red');
      StyleMap.updateSelector(style, 'desktop', 'btn', 'class', 'color', undefined, { componentType: '' });
      expect(style.platform.desktop.btn.attributes.color).toBeUndefined();
      expect(
        StyleMap.updateSelector(style, 'desktop', 'btn', 'class', undefined, { color: 'green' }, { componentType: '' })
      ).toBe(true);
      expect(style.platform.desktop.btn.attributes).toEqual({ color: 'green' });
    });

    it('fails to update when deep path is provided', () => {
      // @ts-expect-error // eslint-disable-line
      expect(StyleMap.updateSelector(style, 'desktop', 'btn', 'class', 'a.b', 'red', { componentType: '' })).toBe(
        false
      );
    });

    it('fails to update when selector is missing', () => {
      expect(StyleMap.updateSelector(style, 'desktop', 'nope', 'class', 'color', 'red', { componentType: '' })).toBe(
        false
      );
      expect(StyleMap.updateSelector(style, 'desktop', 'ghost', 'class', 'color', 'red', { componentType: '' })).toBe(
        false
      );
      expect(style.platform.desktop.ghost).toBeUndefined();
    });

    it('does not allow deep path update for element or class selectors', () => {
      StyleMap.addSelector(style, 'desktop', 'card', 'element', undefined, {}, { componentType: 'button' });
      // @ts-expect-error // eslint-disable-line
      expect(StyleMap.updateSelector(style, 'desktop', 'card', 'element', 'a.b', 'red')).toBe(false);
      // @ts-expect-error // eslint-disable-line
      expect(StyleMap.updateSelector(style, 'desktop', 'btn', 'class', 'a.b', 'red')).toBe(false);
    });

    it('updates selector with state, sets and removes stateAttributes', () => {
      StyleMap.addSelector(style, 'desktop', 'btnStateUpd', 'class', undefined, {}, { componentType: '' });
      expect(
        StyleMap.updateSelector(style, 'desktop', 'btnStateUpd', 'class', 'color', 'red', {
          componentType: '',
          state: 'hover'
        })
      ).toBe(true);
      const item = style.platform.desktop.btnStateUpd as Exclude<StyleItem, { type: 'element' }>;
      expect(item.stateAttributes?.hover?.color).toBe('red');
      StyleMap.updateSelector(style, 'desktop', 'btnStateUpd', 'class', 'color', undefined, {
        componentType: '',
        state: 'hover'
      });
      expect(item.stateAttributes?.hover?.color).toBeUndefined();
    });
  });

  // 5. updateSelector (element)
  describe('updateSelector (element)', () => {
    it('updates value with styleSelector and adds/updates attributes', () => {
      StyleMap.addSelector(style, 'desktop', 'button', 'element', undefined, {}, { componentType: 'button' });
      expect(
        StyleMap.updateSelector(style, 'desktop', 'button', 'element', 'color', 'red', {
          componentType: 'button',
          styleSelector: 'base'
        })
      ).toBe(true);
      const item = style.platform.desktop.button as Extract<StyleItem, { type: 'element' }>;
      expect(item.attributes.base.color).toBe('red');
      expect(
        StyleMap.updateSelector(
          style,
          'desktop',
          'button',
          'element',
          undefined,
          { color: 'purple' },
          { componentType: 'button', styleSelector: 'base2' }
        )
      ).toBe(true);
      expect(item.attributes.base).toEqual({ color: 'red' });
      expect(item.attributes.base2).toEqual({ color: 'purple' });
    });

    it('updates element selector with state and styleSelector', () => {
      StyleMap.addSelector(style, 'desktop', 'cardUpd', 'element', undefined, {}, { componentType: 'button' });
      expect(
        StyleMap.updateSelector(style, 'desktop', 'cardUpd', 'element', 'color', 'red', {
          componentType: 'button',
          styleSelector: 'base',
          state: 'hover'
        })
      ).toBe(true);
      const item = style.platform.desktop.cardUpd as Extract<StyleItem, { type: 'element' }>;
      expect(item.stateAttributes?.base.hover?.color).toBe('red');
    });

    it('updates element selector state without path and sets stateAttributes', () => {
      StyleMap.addSelector(
        style,
        'desktop',
        'stateTest',
        'element',
        undefined,
        { base: { color: 'red' } },
        paramsGeneric
      );
      StyleMap.updateSelector(
        style,
        'desktop',
        'stateTest',
        'element',
        undefined,
        { color: 'blue' },
        { ...paramsGeneric, styleSelector: 'base', state: 'hover' }
      );
      const item = style.platform.desktop.stateTest as Extract<StyleItem, { type: 'element' }>;
      expect(item.stateAttributes?.base.hover?.color).toBe('blue');
      expect(item.attributes.base.color).toBe('red');
    });

    it('does not support deep path for element selector update', () => {
      StyleMap.addSelector(style, 'desktop', 'card', 'element', undefined, {}, { componentType: 'button' });
      // @ts-expect-error // eslint-disable-line
      expect(StyleMap.updateSelector(style, 'desktop', 'card', 'element', 'base.color', 'red')).toBe(false);
    });

    it('resets all selector attributes when styleSelector is undefined and no path is provided', () => {
      StyleMap.addSelector(
        style,
        'desktop',
        'multi',
        'element',
        undefined,
        { base: { color: 'red' }, header: { color: 'blue' } },
        paramsGeneric
      );
      StyleMap.updateSelector(style, 'desktop', 'multi', 'element', undefined, undefined, { ...paramsGeneric });
      const item = style.platform.desktop.multi as Extract<StyleItem, { type: 'element' }>;
      expect(item.attributes.base).toEqual({});
      expect(item.attributes.header).toEqual({});
    });
  });

  // 6. removeSelector
  describe('removeSelector', () => {
    it('removes selector from a specific mode', () => {
      StyleMap.addSelector(style, 'desktop', 'btn', 'class', undefined, {}, { componentType: '' });
      expect(StyleMap.removeSelector(style, 'desktop', 'btn')).toBe(true);
      expect(style.platform.desktop.btn).toBeUndefined();
    });

    it('removes selector from all modes', () => {
      StyleMap.addSelector(style, 'desktop', 'btn', 'class', undefined, {}, { componentType: '' });
      StyleMap.addSelector(style, 'mobile', 'btn', 'class', undefined, {}, { componentType: '' });
      expect(StyleMap.removeSelector(style, undefined, 'btn')).toBe(true);
      expect(style.platform.desktop.btn).toBeUndefined();
      expect(style.platform.mobile.btn).toBeUndefined();
    });

    it('returns false when trying to remove a non-existent selector', () => {
      expect(StyleMap.removeSelector(style, 'desktop', 'nope')).toBe(false);
      const ok = StyleMap.removeSelector(style, undefined, 'nope');
      expect(ok).toBe(false);
    });
  });

  // 7. selector variables
  describe('selector variables', () => {
    beforeEach(() => {
      StyleMap.addSelector(style, 'desktop', 'btn', 'class', undefined, {}, { componentType: '' });
    });

    it('adds selector variable and prevents duplicate', () => {
      expect(
        StyleMap.addSelectorVariable(style, 'desktop', 'btn', StyleVariableCategory.COLOR, 'primary', '#000')
      ).toBe(true);
      expect(style.platform.desktop.btn.variables?.color?.primary).toBe('#000');
      expect(
        StyleMap.addSelectorVariable(style, 'desktop', 'btn', StyleVariableCategory.COLOR, 'primary', '#111')
      ).toBe(false);
    });

    it('updates selector variable value', () => {
      StyleMap.addSelectorVariable(style, 'desktop', 'btn', StyleVariableCategory.COLOR, 'primary', '#000');
      StyleMap.updateSelectorVariable(style, 'desktop', 'btn', StyleVariableCategory.COLOR, 'primary', '#111');
      expect(style.platform.desktop.btn.variables?.color?.primary).toBe('#111');
    });

    it('removes selector variable and handles missing variable gracefully', () => {
      StyleMap.addSelectorVariable(style, 'desktop', 'btn', StyleVariableCategory.COLOR, 'primary', '#000');
      StyleMap.removeSelectorVariable(style, 'desktop', 'btn', StyleVariableCategory.COLOR, 'primary');
      expect(style.platform.desktop.btn.variables).toBeUndefined();
      expect(StyleMap.removeSelectorVariable(style, 'desktop', 'btn', StyleVariableCategory.COLOR, 'nope')).toBe(false);
    });

    it('fails to add selector variable if selector does not exist', () => {
      expect(StyleMap.addSelectorVariable(style, 'desktop', 'nope', StyleVariableCategory.COLOR, 'x', '#000')).toBe(
        false
      );
    });

    it('updates selector variable that does not exist, creating it', () => {
      expect(
        StyleMap.updateSelectorVariable(style, 'desktop', 'btn', StyleVariableCategory.COLOR, 'newVar', '#123')
      ).toBe(true);
      expect(style.platform.desktop.btn.variables?.color?.newVar).toBe('#123');
    });

    it('removes individual selector variables and leaves others intact', () => {
      StyleMap.addSelectorVariable(style, 'desktop', 'btn', StyleVariableCategory.COLOR, 'a', '#000');
      StyleMap.addSelectorVariable(style, 'desktop', 'btn', StyleVariableCategory.COLOR, 'b', '#111');
      StyleMap.removeSelectorVariable(style, 'desktop', 'btn', StyleVariableCategory.COLOR, 'a');
      expect(style.platform.desktop.btn.variables?.color?.a).toBeUndefined();
      expect(style.platform.desktop.btn.variables?.color?.b).toBe('#111');
    });
  });

  // 8. global variables
  describe('global variables', () => {
    it('adds global variable and prevents duplicate', () => {
      expect(StyleMap.addVariable(style, StyleVariableCategory.COLOR, 'primary', '#000')).toBe(true);
      expect(style.variables.color?.primary).toBe('#000');
      expect(StyleMap.addVariable(style, StyleVariableCategory.COLOR, 'primary', '#111')).toBe(false);
    });

    it('updates global variable value', () => {
      StyleMap.addVariable(style, StyleVariableCategory.COLOR, 'primary', '#000');
      StyleMap.updateVariable(style, StyleVariableCategory.COLOR, 'primary', '#111');
      expect(style.variables.color?.primary).toBe('#111');
    });

    it('fails to update or remove non-existent global variable', () => {
      expect(StyleMap.updateVariable(style, StyleVariableCategory.COLOR, 'nope', '#000')).toBe(false);
      expect(StyleMap.removeVariable(style, StyleVariableCategory.COLOR, 'nope')).toBe(false);
    });

    it('removes global variable and category if last variable removed', () => {
      StyleMap.addVariable(style, StyleVariableCategory.COLOR, 'primary', '#000');
      StyleMap.removeVariable(style, StyleVariableCategory.COLOR, 'primary');
      expect(style.variables.color).toBeUndefined();
    });

    it('adds multiple global variables and keeps category present', () => {
      StyleMap.addVariable(style, StyleVariableCategory.COLOR, 'primary', '#000');
      expect(style.variables.color).toBeDefined();
      StyleMap.addVariable(style, StyleVariableCategory.COLOR, 'a', '#000');
      StyleMap.addVariable(style, StyleVariableCategory.COLOR, 'b', '#111');
      expect(Object.keys(style.variables.color ?? {})).toHaveLength(3);
    });
  });

  // 9. edge cases/general
  describe('edge cases/general', () => {
    it('handles empty platform gracefully and regenerates selector cache on update', () => {
      const empty = { platform: {} as StylePlatform, variables: {} };
      expect(() => StyleMap.getSelector(empty, 'desktop', 'btn')).not.toThrow();
      StyleMap.addSelector(style, 'desktop', 'btn', 'class', undefined, {}, paramsGeneric);
      const before = style.platform.desktop.btn.cache;
      StyleMap.updateSelector(style, 'desktop', 'btn', 'class', 'color', 'red', paramsGeneric);
      const after = style.platform.desktop.btn.cache;
      expect(after).not.toBe(before);
    });

    it('does nothing when updateSelector is called with both path and value missing', () => {
      StyleMap.addSelector(style, 'desktop', 'btn', 'class', undefined, {}, paramsGeneric);
      const before = { ...style.platform.desktop.btn.attributes };
      const ok = StyleMap.updateSelector(style, 'desktop', 'btn', 'class', undefined, undefined, paramsGeneric);
      expect(ok).toBe(true);
      expect(style.platform.desktop.btn.attributes).toEqual(before);
    });

    it('allows element selector to be added with undefined value and path (structure created)', () => {
      expect(
        StyleMap.addSelector(style, 'desktop', 'cardZ', 'element', 'color', undefined, {
          styleSelector: 'base',
          componentType: 'button'
        })
      ).toBe(true);
      expect(style.platform.desktop.cardZ).toBeDefined();
    });

    it('does not override normal attributes when updating with state', () => {
      StyleMap.addSelector(style, 'desktop', 'btnMix', 'class', undefined, { color: 'blue' }, { componentType: '' });
      StyleMap.updateSelector(style, 'desktop', 'btnMix', 'class', 'color', 'red', {
        componentType: '',
        state: 'hover'
      });
      const item = style.platform.desktop.btnMix as Exclude<StyleItem, { type: 'element' }>;
      expect(item.attributes.color).toBe('blue');
      expect(item.stateAttributes?.hover?.color).toBe('red');
    });

    it('resets state attributes when value is undefined and no path (class selector)', () => {
      StyleMap.addSelector(style, 'desktop', 'cardReset', 'class', undefined, {}, { componentType: 'button' });
      StyleMap.updateSelector(style, 'desktop', 'cardReset', 'class', undefined, { color: 'blue' }, paramsGeneric);
      StyleMap.updateSelector(
        style,
        'desktop',
        'cardReset',
        'class',
        undefined,
        { color: 'red' },
        { ...paramsGeneric, state: 'hover' }
      );
      StyleMap.updateSelector(style, 'desktop', 'cardReset', 'class', undefined, undefined, {
        ...paramsGeneric,
        state: 'hover'
      });
      const item = style.platform.desktop.cardReset as Exclude<StyleItem, { type: 'element' }>;
      expect(item.stateAttributes?.hover).toEqual({});
      expect(item.attributes).toEqual({ color: 'blue' });
      StyleMap.updateSelector(style, 'desktop', 'cardReset', 'class', undefined, undefined, paramsGeneric);
      expect(item.attributes).toEqual({});
    });

    it('resets state attributes when value is undefined and no path (element selector)', () => {
      StyleMap.addSelector(style, 'desktop', 'cardReset', 'element', undefined, {}, { componentType: 'button' });
      StyleMap.updateSelector(
        style,
        'desktop',
        'cardReset',
        'element',
        undefined,
        { base: { color: 'blue' } },
        paramsGeneric
      );
      StyleMap.updateSelector(
        style,
        'desktop',
        'cardReset',
        'element',
        undefined,
        { base: { color: 'red' } },
        { ...paramsGeneric, state: 'hover' }
      );
      StyleMap.updateSelector(style, 'desktop', 'cardReset', 'element', undefined, undefined, {
        ...paramsGeneric,
        state: 'hover'
      });
      const item = style.platform.desktop.cardReset as Extract<StyleItem, { type: 'element' }>;
      expect(item.stateAttributes?.base.hover).toEqual({});
      expect(item.attributes.base).toEqual({ color: 'blue' });
      StyleMap.updateSelector(style, 'desktop', 'cardReset', 'element', undefined, undefined, paramsGeneric);
      expect(item.attributes.base).toEqual({});
    });
  });
});

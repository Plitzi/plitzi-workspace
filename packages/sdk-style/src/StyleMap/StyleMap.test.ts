import { describe, it, expect, beforeEach } from 'vitest';

import { StyleVariableCategory } from '@plitzi/sdk-shared';

import StyleMap from './StyleMap';

import type { Style, StyleAttributes, StyleState, StyleValue } from '@plitzi/sdk-shared';

const createBaseStyle = (): Pick<Style, 'platform' | 'variables'> => ({
  platform: { desktop: {}, tablet: {}, mobile: {} },
  variables: {}
});

const paramsBase: { componentType?: string; styleSelector: string; styleState?: StyleState; styleVariant?: string } = {
  componentType: undefined,
  styleSelector: 'base'
};

describe('StyleMap', () => {
  let style: Pick<Style, 'platform' | 'variables'>;

  beforeEach(() => {
    style = createBaseStyle();
  });

  describe('addSelector', () => {
    describe('valid additions', () => {
      it('adds default selector', () => {
        expect(StyleMap.addSelector(style, 'desktop', 'btn', 'class', undefined, { color: 'red' }, paramsBase)).toBe(
          true
        );
        expect(style.platform.desktop.btn.attributes.base.default?.color).toBe('red');

        expect(
          StyleMap.addSelector(
            style,
            'desktop',
            'btn2',
            'class',
            undefined,
            { color: 'red', width: undefined },
            paramsBase
          )
        ).toBe(true);
        expect(style.platform.desktop.btn2.attributes.base.default).toStrictEqual({ color: 'red' });
      });

      it('adds state selector', () => {
        const params = { ...paramsBase, styleState: 'hover' as StyleState };
        expect(StyleMap.addSelector(style, 'desktop', 'btn', 'class', undefined, { color: 'blue' }, params)).toBe(true);
        expect(style.platform.desktop.btn.attributes.base.states?.hover?.color).toBe('blue');
      });

      it('adds variant selector', () => {
        const params = { ...paramsBase, styleVariant: 'primary' };
        expect(StyleMap.addSelector(style, 'desktop', 'btn', 'class', undefined, { color: 'green' }, params)).toBe(
          true
        );
        expect(style.platform.desktop.btn.attributes.base.variants?.primary.default?.color).toBe('green');
      });

      it('allows empty object to reset default value', () => {
        expect(StyleMap.addSelector(style, 'desktop', 'btn', 'class', undefined, {}, paramsBase)).toBe(true);
        expect(style.platform.desktop.btn.attributes.base.default).toEqual({});
      });

      it('allows adding ting both state and variant at the same time', () => {
        const params = { ...paramsBase, styleState: 'hover' as const, styleVariant: 'primary' };
        expect(StyleMap.addSelector(style, 'desktop', 'btn', 'class', 'color', 'red', params)).toBe(true);
        expect(style.platform.desktop.btn.attributes.base.variants?.primary.states?.hover?.color).toEqual('red');
      });
    });

    describe('duplicate selectors', () => {
      it('prevents adding duplicate default selectors', () => {
        StyleMap.addSelector(style, 'desktop', 'btn', 'class', undefined, { color: 'red' }, paramsBase);
        expect(StyleMap.addSelector(style, 'desktop', 'btn', 'class', undefined, { color: 'blue' }, paramsBase)).toBe(
          false
        );
        expect(style.platform.desktop.btn.attributes.base.default?.color).toBe('red');
      });

      it('prevents duplicate state selectors', () => {
        const params = { ...paramsBase, styleState: 'hover' as StyleState };
        StyleMap.addSelector(style, 'desktop', 'btn', 'class', undefined, { color: 'red' }, params);
        expect(StyleMap.addSelector(style, 'desktop', 'btn', 'class', undefined, { color: 'blue' }, params)).toBe(
          false
        );
        expect(style.platform.desktop.btn.attributes.base.states?.hover?.color).toBe('red');
      });

      it('prevents duplicate variant selectors', () => {
        const params = { ...paramsBase, styleVariant: 'primary' };
        StyleMap.addSelector(style, 'desktop', 'btn', 'class', undefined, { color: 'red' }, params);
        expect(StyleMap.addSelector(style, 'desktop', 'btn', 'class', undefined, { color: 'blue' }, params)).toBe(
          false
        );
        expect(style.platform.desktop.btn.attributes.base.variants?.primary.default?.color).toBe('red');
      });
    });

    describe('invalid values', () => {
      it('rejects completely invalid value types', () => {
        expect(
          StyleMap.addSelector(style, 'desktop', 'x', 'class', undefined, 123 as unknown as StyleValue, paramsBase)
        ).toBe(false);
        expect(
          StyleMap.addSelector(style, 'desktop', 'y', 'class', undefined, [] as unknown as StyleValue, paramsBase)
        ).toBe(false);
        expect(
          StyleMap.addSelector(style, 'desktop', 'z', 'class', undefined, 'string' as unknown as StyleValue, {
            ...paramsBase,
            styleState: 'hover'
          })
        ).toBe(false);
      });

      it('rejects invalid deep path', () => {
        // @ts-expect-error // eslint-disable-line
        expect(StyleMap.addSelector(style, 'desktop', 'btnInvalid', 'class', 'a.b', { color: 'red' }, paramsBase)).toBe(
          false
        );
        expect(style.platform.desktop.btnInvalid).toBeUndefined();
      });

      it('fails if componentType is missing and is type element', () => {
        expect(
          StyleMap.addSelector(
            style,
            'desktop',
            'btnFail',
            'element',
            undefined,
            { color: 'red' },
            { ...paramsBase, componentType: undefined }
          )
        ).toBe(false);
        expect(style.platform.desktop.btnFail).toBeUndefined();
      });
    });

    describe('invalid componentType and type combinations', () => {
      it('rejects when componentType is defined and type is class or component undefined and type is element', () => {
        expect(
          StyleMap.addSelector(style, 'desktop', 'x', 'class', undefined, undefined, {
            ...paramsBase,
            componentType: 'button'
          })
        ).toBe(false);

        expect(
          StyleMap.addSelector(style, 'desktop', 'y', 'element', undefined, undefined, {
            ...paramsBase,
            componentType: undefined
          })
        ).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('allows undefined value for default', () => {
        expect(StyleMap.addSelector(style, 'desktop', 'btnUndef', 'class', undefined, undefined, paramsBase)).toBe(
          true
        );
        expect(style.platform.desktop.btnUndef.attributes.base.default).toEqual({});
      });

      it('allows undefined value for state', () => {
        const params = { ...paramsBase, styleState: 'hover' as StyleState };
        expect(StyleMap.addSelector(style, 'desktop', 'btnStateUndef', 'class', undefined, undefined, params)).toBe(
          true
        );
        expect(style.platform.desktop.btnStateUndef.attributes.base.states?.hover).toEqual({});
      });

      it('allows undefined value for variant', () => {
        const params = { ...paramsBase, styleVariant: 'primary' };
        expect(StyleMap.addSelector(style, 'desktop', 'btnVarUndef', 'class', undefined, undefined, params)).toBe(true);
        expect(style.platform.desktop.btnVarUndef.attributes.base.variants?.primary.default).toEqual({});
      });

      it('fails when path is defined but value is an object (should be primitive)', () => {
        const before = { ...style.platform.desktop };
        expect(
          StyleMap.addSelector(style, 'desktop', 'badPathObj', 'class', 'color', { color: 'red' }, paramsBase)
        ).toBe(false);
        expect(style.platform.desktop.badPathObj).toBeUndefined();
        expect(style.platform.desktop).toEqual(before);
      });

      it('fails when path is defined and value is array', () => {
        const before = { ...style.platform.desktop };
        // @ts-expect-error // eslint-disable-line
        expect(StyleMap.addSelector(style, 'desktop', 'badPathArr', 'class', 'color', ['red'], paramsBase)).toBe(false);
        expect(style.platform.desktop.badPathArr).toBeUndefined();
        expect(style.platform.desktop).toEqual(before);
      });

      it('fails for state: value is primitive but path is missing (should be object or undefined)', () => {
        const before = { ...style.platform.desktop };
        expect(
          StyleMap.addSelector(style, 'desktop', 'badStatePrim', 'class', undefined, 'red' as unknown as StyleValue, {
            ...paramsBase,
            styleState: 'hover'
          })
        ).toBe(false);
        expect(style.platform.desktop.badStatePrim).toBeUndefined();
        expect(style.platform.desktop).toEqual(before);
      });

      it('fails for variant: value is primitive but path is missing (should be object or undefined)', () => {
        const before = { ...style.platform.desktop };
        expect(
          StyleMap.addSelector(style, 'desktop', 'badVarPrim', 'class', undefined, 42 as unknown as StyleValue, {
            ...paramsBase,
            styleVariant: 'primary'
          })
        ).toBe(false);
        expect(style.platform.desktop.badVarPrim).toBeUndefined();
        expect(style.platform.desktop).toEqual(before);
      });

      it('fails for state: value is array', () => {
        const before = { ...style.platform.desktop };
        expect(
          // @ts-expect-error // eslint-disable-line
          StyleMap.addSelector(style, 'desktop', 'badStateArr', 'class', undefined, ['red'], {
            ...paramsBase,
            styleState: 'hover'
          })
        ).toBe(false);
        expect(style.platform.desktop.badStateArr).toBeUndefined();
        expect(style.platform.desktop).toEqual(before);
      });

      it('fails for variant: value is array', () => {
        const before = { ...style.platform.desktop };
        expect(
          // @ts-expect-error // eslint-disable-line
          StyleMap.addSelector(style, 'desktop', 'badVarArr', 'class', undefined, [1, 2], {
            ...paramsBase,
            styleVariant: 'primary'
          })
        ).toBe(false);
        expect(style.platform.desktop.badVarArr).toBeUndefined();
        expect(style.platform.desktop).toEqual(before);
      });

      it('fails if styleSelector is missing and an invalid value', () => {
        const before = { ...style.platform.desktop };
        expect(
          StyleMap.addSelector(
            style,
            'desktop',
            'noSelector',
            'class',
            undefined,
            { color: 'red' },
            { ...paramsBase, styleSelector: '' }
          )
        ).toBe(false);
        expect(style.platform.desktop.noSelector).toBeUndefined();
        expect(style.platform.desktop).toEqual(before);
      });

      it('fails if componentType is missing or empty and is type element', () => {
        const before = { ...style.platform.desktop };
        expect(
          StyleMap.addSelector(
            style,
            'desktop',
            'noCompType',
            'element',
            undefined,
            { color: 'red' },
            { ...paramsBase, componentType: '' }
          )
        ).toBe(false);
        expect(style.platform.desktop.noCompType).toBeUndefined();
        expect(style.platform.desktop).toEqual(before);
      });

      it('fails if path is a deep path (with a dot)', () => {
        const before = { ...style.platform.desktop };
        expect(
          // @ts-expect-error // eslint-disable-line
          StyleMap.addSelector(style, 'desktop', 'deepPath', 'class', 'base.color', 'red', paramsBase)
        ).toBe(false);
        expect(style.platform.desktop.deepPath).toBeUndefined();
        expect(style.platform.desktop).toEqual(before);
      });

      it('fails if value is a primitive but type is element (should be object)', () => {
        const before = { ...style.platform.desktop };
        expect(
          StyleMap.addSelector(style, 'desktop', 'elPrim', 'element', undefined, 'red' as unknown as StyleValue, {
            ...paramsBase,
            componentType: 'button'
          })
        ).toBe(false);
        expect(style.platform.desktop.elPrim).toBeUndefined();
        expect(style.platform.desktop).toEqual(before);
      });

      it('fails if value is an object but missing styleSelector', () => {
        const before = { ...style.platform.desktop };
        expect(
          StyleMap.addSelector(
            style,
            'desktop',
            'objNoSel',
            'class',
            undefined,
            { color: 'blue' },
            { ...paramsBase, styleSelector: '' }
          )
        ).toBe(false);
        expect(style.platform.desktop.objNoSel).toBeUndefined();
        expect(style.platform.desktop).toEqual(before);
      });

      it('fails if styleSelector is invalid (non-string)', () => {
        const before = { ...style.platform.desktop };
        expect(
          StyleMap.addSelector(
            style,
            'desktop',
            'selNum',
            'class',
            undefined,
            { color: 'red' },
            // @ts-expect-error // eslint-disable-line
            { ...paramsBase, styleSelector: 123 }
          )
        ).toBe(false);
        expect(style.platform.desktop.selNum).toBeUndefined();
        expect(style.platform.desktop).toEqual(before);
      });
    });

    describe('addSelector with multiple styleSelectors', () => {
      it('adds default values for each styleSelector', () => {
        expect(
          StyleMap.addSelector(
            style,
            'desktop',
            'btnMulti',
            'class',
            undefined,
            {
              base: { default: { color: 'red' } },
              header: { default: { color: 'red' } },
              body: { default: { color: 'red' } },
              footer: { default: { color: 'red' } }
            },
            { componentType: undefined, styleSelector: undefined }
          )
        ).toBe(true);
      });

      it('rejects default values for each styleSelector but not base selector', () => {
        expect(
          StyleMap.addSelector(
            style,
            'desktop',
            'btnWithoutBaseMulti',
            'class',
            undefined,
            {
              header: { default: { color: 'red' } },
              body: { default: { color: 'red' } },
              footer: { default: { color: 'red' } }
            },
            { componentType: undefined, styleSelector: undefined }
          )
        ).toBe(false);
      });

      it('rejects states for each styleSelector using a StyleAttributes', () => {
        expect(
          StyleMap.addSelector(
            style,
            'desktop',
            'btnStateMulti',
            'class',
            undefined,
            {
              base: { default: { color: 'blue' } },
              header: { default: { color: 'blue' } },
              body: { default: { color: 'blue' } },
              footer: { default: { color: 'blue' } }
            } satisfies StyleAttributes,
            { componentType: undefined, styleSelector: undefined, styleState: 'hover' }
          )
        ).toBe(false);
      });

      it('rejects variants for each styleSelector using a StyleAttributes', () => {
        expect(
          StyleMap.addSelector(
            style,
            'desktop',
            'btnVarMulti',
            'class',
            undefined,
            {
              base: { default: { color: 'blue' } },
              header: { default: { color: 'blue' } },
              body: { default: { color: 'blue' } },
              footer: { default: { color: 'blue' } }
            } satisfies StyleAttributes,
            { componentType: undefined, styleSelector: undefined, styleVariant: 'primary' }
          )
        ).toBe(false);
      });
    });
  });

  describe('updateSelector', () => {
    beforeEach(() => {
      expect(
        StyleMap.addSelector(
          style,
          'desktop',
          'btn',
          'class',
          undefined,
          {
            base: {
              default: { color: 'red', 'background-color': 'yellow' },
              states: { hover: { color: 'purple' }, focus: { color: 'green' } }
            },
            header: {
              default: { color: 'red' },
              variants: { primary: { default: { color: 'blue' }, states: { hover: { color: 'orange' } } } }
            },
            body: { default: { color: 'red' } },
            footer: { default: { color: 'red' } }
          },
          { componentType: undefined, styleSelector: undefined }
        )
      ).toEqual(true);
    });

    it('updates default value correctly', () => {
      expect(StyleMap.updateSelector(style, 'desktop', 'btn', 'color', 'yellow', paramsBase)).toBe(true);
      expect(style.platform.desktop.btn.attributes.base.default?.color).toBe('yellow');

      expect(
        StyleMap.updateSelector(
          style,
          'desktop',
          'btn',
          undefined,
          { color: 'purple', 'background-color': undefined },
          paramsBase
        )
      ).toBe(true);
      expect(style.platform.desktop.btn.attributes.base.default).toStrictEqual({ color: 'purple' });
    });

    it('updates state value correctly', () => {
      const paramsState = { ...paramsBase, styleState: 'hover' as const };
      expect(StyleMap.updateSelector(style, 'desktop', 'btn', 'color', 'orange', paramsState)).toBe(true);
      expect(style.platform.desktop.btn.attributes.base.states?.hover?.color).toBe('orange');
    });

    it('updates variant value correctly', () => {
      const paramsVariant = { ...paramsBase, styleVariant: 'primary' };
      expect(StyleMap.updateSelector(style, 'desktop', 'btn', 'color', 'purple', paramsVariant)).toBe(true);
      expect(style.platform.desktop.btn.attributes.base.variants?.primary.default?.color).toBe('purple');
    });

    it('rejects update when styleSelector is missing', () => {
      expect(
        StyleMap.updateSelector(style, 'desktop', 'btn', 'color', 'pink', { ...paramsBase, styleSelector: '' })
      ).toBe(false);
    });

    it('rejects update for invalid path', () => {
      // @ts-expect-error // eslint-disable-line
      expect(StyleMap.updateSelector(style, 'desktop', 'btn', 'invalid.path', 'red', paramsBase)).toBe(false);
    });

    it('rejects update when value is array', () => {
      // @ts-expect-error // eslint-disable-line
      expect(StyleMap.updateSelector(style, 'desktop', 'btn', 'color', ['red'], paramsBase)).toBe(false);
    });

    it('allows undefined to reset default value', () => {
      expect(StyleMap.updateSelector(style, 'desktop', 'btn', undefined, undefined, paramsBase)).toBe(true);
      expect(style.platform.desktop.btn.attributes.base.default).toEqual({});
    });

    it('allows empty object to reset default value', () => {
      expect(StyleMap.updateSelector(style, 'desktop', 'btn', undefined, {}, paramsBase)).toBe(true);
      expect(style.platform.desktop.btn.attributes.base.default).toEqual({});
    });

    it('allows undefined to reset state value', () => {
      expect(
        StyleMap.updateSelector(style, 'desktop', 'btn', undefined, undefined, {
          ...paramsBase,
          styleState: 'hover' as const
        })
      ).toBe(true);
      expect(style.platform.desktop.btn.attributes.base.states).toEqual({ focus: { color: 'green' } });
      expect(
        StyleMap.updateSelector(style, 'desktop', 'btn', undefined, undefined, {
          ...paramsBase,
          styleState: 'focus' as const
        })
      ).toBe(true);
      expect(style.platform.desktop.btn.attributes.base.states).toBeUndefined();
    });

    it('allows undefined to reset variant value', () => {
      const paramsVariant = { ...paramsBase, styleVariant: 'primary' };
      expect(StyleMap.updateSelector(style, 'desktop', 'btn', undefined, undefined, paramsVariant)).toBe(true);
      expect(style.platform.desktop.btn.attributes.base.variants).toBeUndefined();

      expect(
        StyleMap.updateSelector(style, 'desktop', 'btn', undefined, undefined, {
          ...paramsVariant,
          styleSelector: 'header'
        })
      ).toBe(true);
      expect(style.platform.desktop.btn.attributes.header.variants).toBeUndefined();
    });

    it('allows updating both state and variant at the same time', () => {
      const params = { ...paramsBase, styleState: 'hover' as const, styleVariant: 'primary' };
      expect(StyleMap.updateSelector(style, 'desktop', 'btn', 'color', 'red', params)).toBe(true);
      expect(style.platform.desktop.btn.attributes.base.variants?.primary.states?.hover?.color).toEqual('red');
    });

    it('does nothing if styleItem does not exist', () => {
      expect(StyleMap.updateSelector(style, 'desktop', 'ghost', 'color', 'red', paramsBase)).toBe(false);
    });
  });

  describe('getSelector', () => {
    it('returns selector if present and undefined if missing', () => {
      StyleMap.addSelector(style, 'desktop', 'btn', 'class', undefined, {}, paramsBase);
      const res = StyleMap.getSelector(style, 'desktop', 'btn');
      expect(res?.name).toBe('btn');
      expect(StyleMap.getSelector(style, 'desktop', 'nope')).toBeUndefined();
    });
  });

  describe('removeSelector', () => {
    it('removes selector from a specific mode', () => {
      StyleMap.addSelector(style, 'desktop', 'btn', 'class', undefined, {}, paramsBase);
      expect(StyleMap.removeSelector(style, 'desktop', 'btn')).toBe(true);
      expect(style.platform.desktop.btn).toBeUndefined();
    });

    it('removes selector from all modes', () => {
      StyleMap.addSelector(style, 'desktop', 'btn', 'class', undefined, {}, paramsBase);
      StyleMap.addSelector(style, 'mobile', 'btn', 'class', undefined, {}, paramsBase);
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

  describe('selector variables', () => {
    beforeEach(() => {
      StyleMap.addSelector(style, 'desktop', 'btn', 'class', undefined, {}, paramsBase);
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

  describe('edge cases/general', () => {
    it('handles empty platform gracefully and regenerates selector cache on update', () => {
      const empty = { platform: {} as Style['platform'], variables: {} };
      expect(() => StyleMap.getSelector(empty, 'desktop', 'btn')).not.toThrow();
      StyleMap.addSelector(style, 'desktop', 'btn', 'class', undefined, {}, paramsBase);
      const before = style.platform.desktop.btn.cache;
      StyleMap.updateSelector(style, 'desktop', 'btn', 'color', 'red', paramsBase);
      const after = style.platform.desktop.btn.cache;
      expect(after).not.toBe(before);
    });

    it('does nothing when updateSelector is called with both path and value missing', () => {
      StyleMap.addSelector(style, 'desktop', 'btn', 'class', undefined, {}, paramsBase);
      const before = { ...style.platform.desktop.btn.attributes };
      const ok = StyleMap.updateSelector(style, 'desktop', 'btn', undefined, undefined, paramsBase);
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

    it('does not override normal attributes when updating with styleState', () => {
      expect(StyleMap.addSelector(style, 'desktop', 'btnMix', 'class', undefined, { color: 'blue' }, paramsBase)).toBe(
        true
      );
      expect(
        StyleMap.updateSelector(style, 'desktop', 'btnMix', 'color', 'red', {
          ...paramsBase,
          componentType: undefined,
          styleState: 'hover'
        })
      ).toBe(true);
      const item = style.platform.desktop.btnMix;
      expect(item.attributes.base.default?.color).toBe('blue');
      expect(item.attributes.base.states?.hover?.color).toBe('red');
    });

    it('resets styleState attributes when value is undefined and no path', () => {
      expect(StyleMap.addSelector(style, 'desktop', 'cardReset', 'class', undefined, {}, paramsBase)).toBe(true);
      expect(StyleMap.updateSelector(style, 'desktop', 'cardReset', undefined, { color: 'blue' }, paramsBase)).toBe(
        true
      );
      expect(
        StyleMap.updateSelector(
          style,
          'desktop',
          'cardReset',
          undefined,
          { color: 'red' },
          { ...paramsBase, styleState: 'hover' }
        )
      ).toBe(true);

      const item = style.platform.desktop.cardReset;
      expect(item.attributes.base.states?.hover).toEqual({ color: 'red' });

      expect(
        StyleMap.updateSelector(style, 'desktop', 'cardReset', undefined, undefined, {
          ...paramsBase,
          styleState: 'hover'
        })
      ).toBe(true);
      expect(item.attributes.base.states).toBeUndefined();
      expect(item.attributes.base.default).toEqual({ color: 'blue' });
      expect(StyleMap.updateSelector(style, 'desktop', 'cardReset', undefined, undefined, paramsBase)).toBe(true);
      expect(
        StyleMap.updateSelector(style, 'desktop', 'cardReset', undefined, undefined, {
          ...paramsBase,
          styleState: 'hover'
        })
      ).toBe(true);
      expect(item.attributes).toEqual({ base: { default: {} } });
    });

    it('should fully remove variant when resetting it (not just default)', () => {
      const paramsVariant = { ...paramsBase, styleVariant: 'primary' };
      expect(
        StyleMap.addSelector(style, 'desktop', 'btnVarBreak', 'class', undefined, { color: 'red' }, paramsVariant)
      ).toBe(true);
      const item = style.platform.desktop.btnVarBreak;
      expect(item.attributes.base.variants?.primary.default).toEqual({ color: 'red' });

      expect(StyleMap.updateSelector(style, 'desktop', 'btnVarBreak', undefined, undefined, paramsVariant)).toBe(true);
      expect(item.attributes.base.variants).toBeUndefined();
    });

    it('fails when merging object with undefined keys into a state using path', () => {
      const paramsState = { ...paramsBase, styleState: 'hover' as const };
      expect(
        StyleMap.addSelector(
          style,
          'desktop',
          'btnEdge',
          'class',
          undefined,
          { color: 'red', width: '10px' },
          paramsState
        )
      ).toEqual(true);
      const item = style.platform.desktop.btnEdge;
      expect(item.attributes.base.states?.hover).toEqual({ color: 'red', width: '10px' });
      expect(StyleMap.updateSelector(style, 'desktop', 'btnEdge', 'width', { width: undefined }, paramsState)).toEqual(
        false
      );
      expect(StyleMap.updateSelector(style, 'desktop', 'btnEdge', 'width', undefined, paramsState)).toEqual(true);
      expect(item.attributes.base.states?.hover).toEqual({ color: 'red' });
    });

    it('should not resurrect state or variant after consecutive resets with empty object merge', () => {
      const paramsState = { ...paramsBase, styleState: 'hover' as const };
      const paramsVariant = { ...paramsBase, styleVariant: 'primary' };

      StyleMap.addSelector(style, 'desktop', 'btnEdgeCase', 'class', undefined, { color: 'red' }, paramsState);
      StyleMap.addSelector(style, 'desktop', 'btnEdgeCase', 'class', undefined, { color: 'blue' }, paramsVariant);

      const item = style.platform.desktop.btnEdgeCase;

      // Reset state y variant
      StyleMap.updateSelector(style, 'desktop', 'btnEdgeCase', undefined, undefined, paramsState);
      StyleMap.updateSelector(style, 'desktop', 'btnEdgeCase', undefined, undefined, paramsVariant);

      expect(item.attributes.base.states).toBeUndefined();
      expect(item.attributes.base.variants).toBeUndefined();

      // Merge empty object
      StyleMap.updateSelector(style, 'desktop', 'btnEdgeCase', undefined, {}, paramsState);
      expect(item.attributes.base.states).toBeUndefined();
    });
  });
});

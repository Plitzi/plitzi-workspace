import { describe, it, expect, beforeEach } from 'vitest';

import StyleMap from './StyleMap';
import { createBaseStyle, paramsBase } from './tests/StyleMap';

import type { Style, StyleAttributes, StyleState, StyleValue } from '@plitzi/sdk-shared';

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

      it('allows empty object or undefined to create new selector with componentType and no selectorStyle', () => {
        expect(StyleMap.addSelector(style, 'desktop', 'btn', 'class', undefined, {}, {})).toBe(true);
        expect(style.platform.desktop.btn.attributes.base.default).toEqual({});

        expect(StyleMap.addSelector(style, 'desktop', 'btn2', 'class', undefined, undefined, {})).toBe(true);
        expect(style.platform.desktop.btn2.attributes.base.default).toEqual({});

        expect(
          StyleMap.addSelector(style, 'desktop', 'button', 'element', undefined, {}, { componentType: 'button' })
        ).toBe(true);
        expect(style.platform.desktop.button.attributes.base.default).toEqual({});
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
        expect(StyleMap.addSelector(style, 'desktop', 'x', 'class', undefined, 123, paramsBase)).toBe(false);
        expect(
          StyleMap.addSelector(style, 'desktop', 'y', 'class', undefined, [] as unknown as StyleValue, paramsBase)
        ).toBe(false);
        expect(
          StyleMap.addSelector(style, 'desktop', 'z', 'class', undefined, 'string', {
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

        expect(StyleMap.addSelector(style, 'desktop', 'btnUndef2', 'class', undefined, undefined, {})).toBe(true);
        expect(style.platform.desktop.btnUndef2.attributes.base.default).toEqual({});
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
          StyleMap.addSelector(style, 'desktop', 'badStatePrim', 'class', undefined, 'red', {
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
          StyleMap.addSelector(style, 'desktop', 'badVarPrim', 'class', undefined, 42, {
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
          StyleMap.addSelector(style, 'desktop', 'elPrim', 'element', undefined, 'red', {
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
});

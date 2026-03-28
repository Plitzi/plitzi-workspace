/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { describe, it, expect } from 'vitest';

import isValidValue from './isValueValid';

import type { StyleAttributes, StyleStates, StyleVariants } from '@plitzi/sdk-shared';

describe('isValidValue (context-based)', () => {
  describe('path mode (primitive only)', () => {
    it('accepts string', () => {
      expect(isValidValue('color', 'red')).toBe(true);
    });

    it('accepts number', () => {
      expect(isValidValue('color', 123)).toBe(true);
    });

    it('rejects object', () => {
      expect(isValidValue('color', { color: 'red' })).toBe(false);
    });

    it('rejects array', () => {
      expect(isValidValue('color', ['red'] as any)).toBe(false);
    });
  });

  describe('full attributes (no params)', () => {
    it('accepts StyleAttributes', () => {
      expect(isValidValue(undefined, undefined, {})).toBe(true);
      expect(isValidValue(undefined, { base: { default: { color: 'red' } } })).toBe(true);
      expect(
        isValidValue(undefined, {
          base: { default: { color: 'red' } },
          selectorA: { default: { color: 'red' } },
          selectorB: { default: { color: 'red' } }
        })
      ).toBe(true);
      expect(
        isValidValue(undefined, {
          base: { default: { color: 'red', 'background-color': 'yellow' }, states: { hover: { color: 'purple' } } },
          header: {
            default: { color: 'red' },
            variants: { primary: { default: { color: 'blue' }, states: { hover: { color: 'orange' } } } }
          }
        })
      ).toBe(true);
    });

    it('rejects StyleAttributes without base selector', () => {
      expect(
        isValidValue(undefined, {
          selectorA: { default: { color: 'red' } },
          selectorB: { default: { color: 'red' } }
        })
      ).toBe(false);
    });

    it('rejects primitive', () => {
      expect(isValidValue(undefined, 'red')).toBe(false);
    });

    it('rejects array', () => {
      expect(isValidValue(undefined, [] as any)).toBe(false);
    });

    it('rejects objects', () => {
      expect(isValidValue(undefined, { base: { color: 'red' } } as any)).toBe(false);
      expect(isValidValue(undefined, { base: {} })).toBe(false);
    });
  });

  describe('styleSelector', () => {
    const params = { styleSelector: 'base' };

    it('accepts StyleBlock', () => {
      expect(isValidValue(undefined, { default: { color: 'red' } }, params)).toBe(true);
    });

    it('accepts flat StyleObject (merge)', () => {
      expect(isValidValue(undefined, { color: 'red' }, params)).toBe(true);
    });

    it('rejects primitive', () => {
      expect(isValidValue(undefined, 'red', params)).toBe(false);
    });

    it('rejects array', () => {
      expect(isValidValue(undefined, [] as any, params)).toBe(false);
    });
  });

  describe('styleState', () => {
    const params = { styleSelector: 'base', styleState: 'hover' as const };

    it('accepts StyleObject', () => {
      expect(isValidValue(undefined, { color: 'red' }, params)).toBe(true);
    });

    it('accepts undefined', () => {
      expect(isValidValue(undefined, undefined, params)).toBe(true);
    });

    it('rejects primitive', () => {
      expect(isValidValue(undefined, 'red', params)).toBe(false);
    });

    it('rejects array', () => {
      expect(isValidValue(undefined, ['red'] as any, params)).toBe(false);
    });

    it('accepts StyleStates and styleSelector is undefined', () => {
      expect(
        isValidValue(undefined, { hover: { color: 'blue' } } satisfies StyleStates, {
          ...params,
          styleSelector: undefined
        })
      ).toBe(true);
    });

    it('rejects StyleAttributes and styleSelector is undefined', () => {
      expect(
        isValidValue(
          undefined,
          {
            base: { default: { color: 'blue' }, variants: { primary: { default: { color: 'purple' } } } },
            header: { default: { color: 'blue' } },
            body: { default: { color: 'blue' } },
            footer: { default: { color: 'blue' } }
          } satisfies StyleAttributes,
          { ...params, styleSelector: undefined }
        )
      ).toBe(false);
    });
  });

  describe('styleVariant', () => {
    const params = { styleSelector: 'base', styleVariant: 'primary' };

    it('accepts StyleObject (merge)', () => {
      expect(isValidValue(undefined, { color: 'blue' }, params)).toBe(true);
    });

    it('accepts full variant block', () => {
      expect(isValidValue(undefined, { default: { color: 'blue' }, states: { hover: { color: 'red' } } }, params)).toBe(
        true
      );
    });

    it('accepts nested variants', () => {
      expect(
        isValidValue(
          undefined,
          { default: { color: 'blue' }, variants: { secondary: { default: { color: 'red' } } } },
          params
        )
      ).toBe(true);
    });

    it('rejects primitive', () => {
      expect(isValidValue(undefined, 123, params)).toBe(false);
    });

    it('rejects array', () => {
      expect(isValidValue(undefined, [1, 2] as any, params)).toBe(false);
    });

    it('accepts StyleVariants and styleSelector is undefined', () => {
      expect(
        isValidValue(
          undefined,
          {
            primary: { default: { color: 'blue' } },
            secondary: { default: { color: 'blue' } },
            third: { default: { color: 'blue' } },
            forth: { default: { color: 'blue' } }
          } satisfies StyleVariants,
          { ...params, styleSelector: undefined }
        )
      ).toBe(true);
    });

    it('rejects StyleAttributes and styleSelector is undefined', () => {
      expect(
        isValidValue(
          undefined,
          {
            base: { default: { color: 'blue' }, variants: { primary: { default: { color: 'purple' } } } },
            header: { default: { color: 'blue' } },
            body: { default: { color: 'blue' } },
            footer: { default: { color: 'blue' } }
          } satisfies StyleAttributes,
          { ...params, styleSelector: undefined }
        )
      ).toBe(false);
    });
  });

  describe('styleVariants + styleState', () => {
    const params = { styleSelector: 'base', styleState: 'hover' as const, styleVariant: 'primary' };

    it('rejects when styleSelector is undefined', () => {
      expect(
        isValidValue(
          undefined,
          {
            base: { default: { color: 'blue' } },
            header: { default: { color: 'blue' } },
            body: { default: { color: 'blue' } },
            footer: { default: { color: 'blue' } }
          },
          { ...params, styleSelector: undefined }
        )
      ).toBe(false);
    });
  });
});

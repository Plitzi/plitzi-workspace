import { describe, it, expect } from 'vitest';

import calculateInheriting from './calculateInheriting';

import type { Element, Schema, Style } from '@plitzi/sdk-shared';

const baseElement: Element = {
  id: '1',
  attributes: {},
  definition: {
    label: 'Button',
    type: 'button',
    rootId: '1',
    parentId: undefined,
    styleSelectors: { base: 'btn' }
  }
};

describe('calculateInheriting', () => {
  describe('basic behavior', () => {
    it('returns empty metadata when no element and no componentType', () => {
      const result = calculateInheriting(undefined, undefined, {}, { desktop: {}, tablet: {}, mobile: {} });
      expect(result.style).toEqual({});
      expect(result.tree).toEqual([]);
    });

    it('applies base styles from platform', () => {
      const platform: Style['platform'] = {
        desktop: {
          btn: {
            name: 'btn',
            type: 'class',
            attributes: { color: 'red' },
            cache: ''
          }
        },
        tablet: {},
        mobile: {}
      };

      const result = calculateInheriting(baseElement, undefined, {}, platform);

      expect(result.style.color[0].value).toBe('red');
    });
  });

  describe('display modes', () => {
    it('merges multiple display modes', () => {
      const platform: Style['platform'] = {
        desktop: {
          btn: { name: 'btn', type: 'class', attributes: { color: 'red' }, cache: '' }
        },
        tablet: {
          btn: { name: 'btn', type: 'class', attributes: { color: 'blue' }, cache: '' }
        },
        mobile: {}
      };

      const result = calculateInheriting(baseElement, undefined, {}, platform);

      expect(result.style.color.length).toBeGreaterThan(1);
    });
  });

  describe('element type', () => {
    it('handles element base attributes', () => {
      const platform: Style['platform'] = {
        desktop: {
          btn: {
            name: 'btn',
            type: 'element',
            attributes: { base: { color: 'green' } },
            componentType: 'button',
            cache: ''
          }
        },
        tablet: {},
        mobile: {}
      };

      const result = calculateInheriting(baseElement, 'button', {}, platform);

      expect(result.style.color[0].value).toBe('green');
    });
  });

  describe('selectors', () => {
    it('skips selectors when provided', () => {
      const platform: Style['platform'] = {
        desktop: {
          btn: { name: 'btn', type: 'class', attributes: { color: 'red' }, cache: '' }
        },
        tablet: {},
        mobile: {}
      };

      const result = calculateInheriting(baseElement, undefined, {}, platform, 'base', {}, ['btn']);

      expect(result.style.color).toBeUndefined();
    });
  });

  describe('parent inheritance', () => {
    it('inherits parent styles', () => {
      const element = {
        ...baseElement,
        definition: { ...baseElement.definition, parentId: 'parent' }
      };

      const flat: Schema['flat'] = {
        parent: {
          id: 'parent',
          attributes: {},
          definition: {
            label: 'Button',
            type: 'button',
            rootId: 'parent',
            parentId: undefined,
            styleSelectors: { base: 'parentBtn' }
          }
        }
      };

      const platform: Style['platform'] = {
        desktop: {
          parentBtn: {
            name: 'parentBtn',
            type: 'class',
            attributes: { color: 'purple' },
            cache: ''
          }
        },
        tablet: {},
        mobile: {}
      };

      const result = calculateInheriting(element, undefined, flat, platform);

      expect(result.parentStyle.color).toBe('purple');
    });
  });
});

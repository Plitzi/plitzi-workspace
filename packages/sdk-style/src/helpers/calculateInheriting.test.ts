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

const emptyPlatform: Style['platform'] = { desktop: {}, tablet: {}, mobile: {} };

describe('calculateInheriting', () => {
  /* ----------------------------- BASIC CASES ----------------------------- */
  describe('basic behavior', () => {
    it('returns empty when no element and no componentType', () => {
      const result = calculateInheriting(undefined, undefined, {}, emptyPlatform);
      expect(result.style).toEqual({});
      expect(result.tree).toEqual([]);
    });

    it('handles empty platform safely', () => {
      const result = calculateInheriting(baseElement, undefined, {}, emptyPlatform);
      expect(result.style).toEqual({});
    });
  });

  /* ----------------------------- SELECTORS ------------------------------ */
  describe('selectors (class styles)', () => {
    it('applies base class styles', () => {
      const platform: Style['platform'] = {
        desktop: {
          btn: { name: 'btn', type: 'class', attributes: { color: 'red' }, cache: '' }
        },
        tablet: {},
        mobile: {}
      };

      const result = calculateInheriting(baseElement, undefined, {}, platform);
      expect(result.style.color[0].value).toBe('red');
    });

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

    it('handles multiple selectors', () => {
      const element: Element = {
        ...baseElement,
        definition: { ...baseElement.definition, styleSelectors: { base: 'btn card' } }
      };

      const platform: Style['platform'] = {
        desktop: {
          btn: { name: 'btn', type: 'class', attributes: { color: 'red' }, cache: '' },
          card: { name: 'card', type: 'class', attributes: { 'background-color': 'blue' }, cache: '' }
        },
        tablet: {},
        mobile: {}
      };

      const result = calculateInheriting(element, undefined, {}, platform);

      expect(result.style.color[0].value).toBe('red');
      expect(result.style['background-color'][0].value).toBe('blue');
    });
  });

  /* ----------------------------- DISPLAY MODES -------------------------- */
  describe('responsive (display modes)', () => {
    it('merges styles across display modes', () => {
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

    it('handles missing displayMode safely', () => {
      const platform = { desktop: {} } as Style['platform'];

      const result = calculateInheriting(baseElement, undefined, {}, platform);
      expect(result.style).toEqual({});
    });
  });

  /* ----------------------------- ELEMENT TYPE --------------------------- */
  describe('element type styles', () => {
    it('applies element styles over class styles', () => {
      const platform: Style['platform'] = {
        desktop: {
          btn: { name: 'btn', type: 'class', attributes: { color: 'red' }, cache: '' },
          el: {
            name: 'el',
            type: 'element',
            componentType: 'button',
            attributes: { base: { color: 'green' } },
            cache: ''
          }
        },
        tablet: {},
        mobile: {}
      };

      const result = calculateInheriting(baseElement, 'button', {}, platform);

      expect(result.style.color.some(s => s.value === 'green')).toBe(true);
    });

    it('works without element using only componentType', () => {
      const platform: Style['platform'] = {
        desktop: {
          el: {
            name: 'el',
            type: 'element',
            componentType: 'button',
            attributes: { base: { color: 'green' } },
            cache: ''
          }
        },
        tablet: {},
        mobile: {}
      };

      const result = calculateInheriting(undefined, 'button', {}, platform);

      expect(result.style.color[0].value).toBe('green');
    });
  });

  /* ----------------------------- INHERITANCE ---------------------------- */
  describe('inheritance (parent chain)', () => {
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
            label: 'Parent',
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
            attributes: { color: 'purple', 'margin-top': '10px' },
            cache: ''
          }
        },
        tablet: {},
        mobile: {}
      };

      const result = calculateInheriting(element, undefined, flat, platform);

      expect(result.parentStyle.color).toBe('purple');
    });

    it('only inherits allowed attributes from ancestors', () => {
      const element = {
        ...baseElement,
        definition: { ...baseElement.definition, parentId: 'parent' }
      };

      const flat: Schema['flat'] = {
        parent: {
          id: 'parent',
          attributes: {},
          definition: {
            label: 'Parent',
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
            attributes: { position: 'absolute', color: 'purple' },
            cache: ''
          }
        },
        tablet: {},
        mobile: {}
      };

      const result = calculateInheriting(element, undefined, flat, platform);

      // position is usually not inheritable
      expect(result.style.position).toBeUndefined();
    });
  });

  /* ----------------------------- EDGE CASES ----------------------------- */
  describe('edge cases', () => {
    it('handles unknown selectors safely', () => {
      const element: Element = {
        ...baseElement,
        definition: { ...baseElement.definition, styleSelectors: { base: 'unknown' } }
      };

      const result = calculateInheriting(element, undefined, {}, emptyPlatform);
      expect(result.style).toEqual({});
    });

    it('handles empty style objects', () => {
      const platform: Style['platform'] = {
        desktop: {
          btn: { name: 'btn', type: 'class', attributes: {}, cache: '' }
        },
        tablet: {},
        mobile: {}
      };

      const result = calculateInheriting(baseElement, undefined, {}, platform);
      expect(result.style).toEqual({});
    });

    it('does not crash with malformed attributes', () => {
      const platform: Style['platform'] = {
        desktop: {
          btn: {
            name: 'btn',
            type: 'class',
            // @ts-expect-error // eslint-disable-line
            attributes: { base: { invalid: { nested: true } } },
            cache: ''
          }
        },
        tablet: {},
        mobile: {}
      };

      const result = calculateInheriting(baseElement, undefined, {}, platform);
      expect(result.style).toBeDefined();
    });
  });
});

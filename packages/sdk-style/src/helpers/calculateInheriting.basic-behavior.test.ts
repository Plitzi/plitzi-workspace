import { describe, it, expect } from 'vitest';

import calculateInheriting from './calculateInheriting';
import { baseElement, emptyPlatform } from './tests/calculateInheriting';

import type { Element, Schema, Style } from '@plitzi/sdk-shared';

describe('calculateInheriting', () => {
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

    it('should NOT include current element styles when no state/variant (only inherited)', () => {
      const element = {
        ...baseElement,
        definition: {
          ...baseElement.definition,
          parentId: 'parent'
        }
      } as Element;

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
          btn: {
            name: 'btn',
            type: 'class',
            attributes: {
              base: { default: { color: 'red' } } // 🔥 current
            },
            cache: ''
          },
          parentBtn: {
            name: 'parentBtn',
            type: 'class',
            attributes: {
              base: { default: { color: 'blue' } } // 🔥 inherited
            },
            cache: ''
          }
        },
        tablet: {},
        mobile: {}
      };

      const result = calculateInheriting(element, undefined, flat, platform, undefined, {
        styleSelector: 'base'
      });

      const values = result.style.color.map(v => v.value);

      // 🔥 NO debe incluir el current ('red')
      expect(values.includes('red')).toBe(false);

      // 🔥 solo debe incluir el inherited
      expect(values.includes('blue')).toBe(true);
    });
  });
  describe('selectors', () => {
    it('applies base class styles', () => {
      const platform: Style['platform'] = {
        desktop: {
          btn: { name: 'btn', type: 'class', attributes: { base: { default: { color: 'red' } } }, cache: '' }
        },
        tablet: {},
        mobile: {}
      };

      const result = calculateInheriting(baseElement, undefined, {}, platform, undefined, { includeSelf: true });
      expect(result.style.color[0].value).toBe('red');
    });

    it('skips selectors when provided', () => {
      const platform: Style['platform'] = {
        desktop: {
          btn: { name: 'btn', type: 'class', attributes: { base: { default: { color: 'red' } } }, cache: '' }
        },
        tablet: {},
        mobile: {}
      };

      const result = calculateInheriting(baseElement, undefined, {}, platform, undefined, {
        styleSelector: 'base',
        skipSelectors: ['btn']
      });
      expect(result.style.color).toBeUndefined();
    });

    it('handles multiple selectors', () => {
      const element: Element = {
        ...baseElement,
        definition: { ...baseElement.definition, styleSelectors: { base: 'btn card' } }
      };

      const platform: Style['platform'] = {
        desktop: {
          btn: { name: 'btn', type: 'class', attributes: { base: { default: { color: 'red' } } }, cache: '' },
          card: {
            name: 'card',
            type: 'class',
            attributes: { base: { default: { 'background-color': 'blue' } } },
            cache: ''
          }
        },
        tablet: {},
        mobile: {}
      };

      const result = calculateInheriting(element, undefined, {}, platform, undefined, { includeSelf: true });

      expect(result.style.color[0].value).toBe('red');
      expect(result.style['background-color'][0].value).toBe('blue');
    });
  });
  describe('responsive (display modes)', () => {
    it('merges styles across display modes', () => {
      const platform: Style['platform'] = {
        desktop: {
          btn: { name: 'btn', type: 'class', attributes: { base: { default: { color: 'red' } } }, cache: '' }
        },
        tablet: {
          btn: { name: 'btn', type: 'class', attributes: { base: { default: { color: 'blue' } } }, cache: '' }
        },
        mobile: {}
      };

      const result = calculateInheriting(baseElement, undefined, {}, platform, undefined, { includeSelf: true });
      expect(result.style.color.length).toBeGreaterThan(1);
    });

    it('handles missing displayMode safely', () => {
      const platform = { desktop: {} } as Style['platform'];

      const result = calculateInheriting(baseElement, undefined, {}, platform);
      expect(result.style).toEqual({});
    });
  });
  describe('element type styles', () => {
    it('applies element styles over class styles', () => {
      const platform: Style['platform'] = {
        desktop: {
          btn: { name: 'btn', type: 'class', attributes: { base: { default: { color: 'red' } } }, cache: '' },
          el: {
            name: 'el',
            type: 'element',
            componentType: 'button',
            attributes: { base: { default: { color: 'green' } } },
            cache: ''
          }
        },
        tablet: {},
        mobile: {}
      };

      const result = calculateInheriting(baseElement, 'button', {}, platform, undefined, { includeSelf: true });

      expect(result.style.color.some(s => s.value === 'green')).toBe(true);
    });

    it('works without element using only componentType', () => {
      const platform: Style['platform'] = {
        desktop: {
          el: {
            name: 'el',
            type: 'element',
            componentType: 'button',
            attributes: { base: { default: { color: 'green' } } },
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
            attributes: { base: { default: { color: 'purple', 'margin-top': '10px' } } },
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
            attributes: { base: { default: { position: 'absolute', color: 'purple' } } },
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
  describe('variants and states', () => {
    it('applies base + variant + state correctly', () => {
      const platform: Style['platform'] = {
        desktop: {
          btn: {
            name: 'btn',
            type: 'class',
            attributes: {
              base: {
                default: { color: 'red', 'padding-top': '10px' },
                states: { hover: { color: 'blue' } },
                variants: {
                  primary: {
                    default: { color: 'green' },
                    states: { hover: { color: 'yellow' } }
                  }
                }
              }
            },
            cache: ''
          }
        },
        tablet: {},
        mobile: {}
      };

      const result = calculateInheriting(baseElement, undefined, {}, platform, undefined, {
        styleSelector: 'base',
        styleState: 'hover',
        styleVariant: 'primary'
      });

      // 🔥 orden correcto
      expect(result.style.color[0].value).toBe('yellow');
    });

    it('state + variant + ancestor + displayMode combined', () => {
      const element = {
        ...baseElement,
        definition: { ...baseElement.definition, parentId: 'parent' }
      } as Element;

      const flat: Schema['flat'] = {
        parent: {
          id: 'parent',
          attributes: {},
          definition: {
            label: 'Parent',
            type: 'button',
            rootId: 'parent',
            parentId: 'ancestor',
            styleSelectors: { base: 'parentBtn' }
          }
        },
        ancestor: {
          id: 'ancestor',
          attributes: {},
          definition: {
            label: 'Ancestor',
            type: 'button',
            rootId: 'ancestor',
            parentId: undefined,
            styleSelectors: { base: 'ancestorBtn' }
          }
        }
      };

      const platform: Style['platform'] = {
        desktop: {
          ancestorBtn: {
            name: 'ancestorBtn',
            type: 'class',
            attributes: { base: { default: { color: 'blue' }, states: { hover: { color: 'cyan' } } } },
            cache: ''
          },
          parentBtn: {
            name: 'parentBtn',
            type: 'class',
            attributes: { base: { default: { color: 'green' }, states: { hover: { color: 'lime' } } } },
            cache: ''
          },
          btn: {
            name: 'btn',
            type: 'class',
            attributes: { base: { default: { color: 'red' }, states: { hover: { color: 'yellow' } } } },
            cache: ''
          }
        },
        tablet: {
          btn: {
            name: 'btn',
            type: 'class',
            attributes: { base: { default: { color: 'pink' } } },
            cache: ''
          }
        },
        mobile: {
          btn: {
            name: 'btn',
            type: 'class',
            attributes: { base: { default: { color: 'orange' } } },
            cache: ''
          }
        }
      };

      const result = calculateInheriting(element, undefined, flat, platform, undefined, {
        styleSelector: 'base',
        styleState: 'hover'
      });

      // 🔥 current state overrides everything in desktop
      const desktopValue = result.style.color.find(v => v.displayMode === 'desktop')?.value;
      expect(desktopValue).toBe('yellow');

      // 🔥 parent state appears correctly as parentStyle
      expect(result.parentStyle.color).toBe('lime');

      // 🔥 ancestor state is picked only for inheritable attrs
      expect(result.style.color.some(v => v.value === 'cyan')).toBe(true);

      // 🔥 tablet uses correct fallback
      const tabletValue = result.style.color.find(v => v.displayMode === 'tablet')?.value;
      expect(tabletValue).toBe('pink');

      // 🔥 mobile uses correct fallback
      const mobileValue = result.style.color.find(v => v.displayMode === 'mobile')?.value;
      expect(mobileValue).toBe('orange');
    });
  });
});

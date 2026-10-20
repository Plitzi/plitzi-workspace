import { describe, it, expect } from 'vitest';

import calculateInheriting from './calculateInheriting';
import { baseElement } from './tests/calculateInheriting';

import type { Element, Schema, Style } from '@plitzi/sdk-shared';

describe('calculateInheriting', () => {
  describe('edge cases', () => {
    it('skipSelectors should not skip ancestors', () => {
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
            attributes: { base: { default: { color: 'purple' } } },
            cache: ''
          }
        },
        tablet: {},
        mobile: {}
      };

      const result = calculateInheriting(element, undefined, flat, platform, undefined, {
        styleSelector: 'base',
        skipSelectors: ['parentBtn']
      });

      // should still inherit because it's ancestor
      expect(result.style.color[0]?.value).toBe('purple');
    });
    it('duplicate selectors should not duplicate values in finalStyle', () => {
      const element: Element = {
        ...baseElement,
        definition: { ...baseElement.definition, styleSelectors: { base: 'btn btn' } }
      };

      const platform: Style['platform'] = {
        desktop: {
          btn: {
            name: 'btn',
            type: 'class',
            attributes: { base: { default: { color: 'red' } } },
            cache: ''
          }
        },
        tablet: {},
        mobile: {}
      };

      const result = calculateInheriting(element, undefined, {}, platform, undefined, { includeSelf: true });

      // 🔥 si falla → duplicación silenciosa
      expect(result.style.color.length).toBe(1);
    });
    it('first priority (current element) should win over parent and ancestor', () => {
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
            attributes: { base: { default: { color: 'blue' } } },
            cache: ''
          },
          parentBtn: {
            name: 'parentBtn',
            type: 'class',
            attributes: { base: { default: { color: 'green' } } },
            cache: ''
          },
          btn: {
            name: 'btn',
            type: 'class',
            attributes: { base: { default: { color: 'red' } } },
            cache: ''
          }
        },
        tablet: {},
        mobile: {}
      };

      const result = calculateInheriting(element, undefined, flat, platform, undefined, { includeSelf: true });
      const values = result.style.color.map(v => v.value);

      expect(values[0]).toBe('red');
    });
    describe('inheritable filtering — non-inheritable properties must not leak', () => {
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
            parentId: undefined,
            styleSelectors: { base: 'parentBtn' }
          }
        }
      };

      it('ancestors must NOT contribute display to style', () => {
        const platform: Style['platform'] = {
          desktop: {
            parentBtn: {
              name: 'parentBtn',
              type: 'class',
              attributes: { base: { default: { display: 'flex', color: 'red' } } },
              cache: ''
            }
          },
          tablet: {},
          mobile: {}
        };

        const result = calculateInheriting(element, undefined, flat, platform);

        expect(result.style.display).toBeUndefined();
        expect(result.style.color).toBeDefined();
      });

      it('ancestors must NOT contribute background-color to style', () => {
        const platform: Style['platform'] = {
          desktop: {
            parentBtn: {
              name: 'parentBtn',
              type: 'class',
              attributes: { base: { default: { 'background-color': 'red', color: 'blue' } } },
              cache: ''
            }
          },
          tablet: {},
          mobile: {}
        };

        const result = calculateInheriting(element, undefined, flat, platform);

        expect(result.style['background-color']).toBeUndefined();
        expect(result.style.color).toBeDefined();
      });

      it('ancestors must NOT contribute margin/padding to style', () => {
        const platform: Style['platform'] = {
          desktop: {
            parentBtn: {
              name: 'parentBtn',
              type: 'class',
              attributes: {
                base: {
                  default: {
                    'margin-top': '10px',
                    'padding-left': '5px',
                    'font-size': '14px',
                    opacity: '0.5'
                  }
                }
              },
              cache: ''
            }
          },
          tablet: {},
          mobile: {}
        };

        const result = calculateInheriting(element, undefined, flat, platform);

        expect(result.style['margin-top']).toBeUndefined();
        expect(result.style['padding-left']).toBeUndefined();
        expect(result.style.opacity).toBeUndefined();
        expect(result.style['font-size']).toBeDefined();
      });

      it('ancestors must NOT contribute width/height to style', () => {
        const platform: Style['platform'] = {
          desktop: {
            parentBtn: {
              name: 'parentBtn',
              type: 'class',
              attributes: { base: { default: { width: '100%', height: '200px', color: 'green' } } },
              cache: ''
            }
          },
          tablet: {},
          mobile: {}
        };

        const result = calculateInheriting(element, undefined, flat, platform);

        expect(result.style.width).toBeUndefined();
        expect(result.style.height).toBeUndefined();
        expect(result.style.color).toBeDefined();
      });
    });
    it('deeply nested hierarchy should respect priority', () => {
      const flat: Schema['flat'] = {};
      let parentId = undefined;
      for (let i = 0; i < 10; i++) {
        const id = `node${i}`;
        flat[id] = {
          id,
          attributes: {},
          definition: {
            label: `Node ${i}`,
            type: 'button',
            rootId: id,
            parentId,
            styleSelectors: { base: id }
          }
        };
        parentId = id;
      }

      const platform: Style['platform'] = {
        desktop: {},
        tablet: {},
        mobile: {}
      };
      Object.keys(flat).forEach((id, idx) => {
        platform.desktop[id] = {
          name: id,
          type: 'class',
          attributes: { base: { default: { color: `color${idx}` } } },
          cache: ''
        };
      });

      const result = calculateInheriting(flat['node9'], undefined, flat, platform, undefined, {
        styleSelector: 'base',
        includeSelf: true
      });

      // 🔥 first node color wins
      const lastColor = result.style.color[0]?.value;
      expect(lastColor).toBe('color9');
    });
  });
});

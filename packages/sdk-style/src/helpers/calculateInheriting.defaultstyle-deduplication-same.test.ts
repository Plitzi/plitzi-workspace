import { describe, it, expect } from 'vitest';

import calculateInheriting from './calculateInheriting';
import { baseElement, emptyPlatform } from './tests/calculateInheriting';

import type { ComponentDefinition, Element, Schema, Style } from '@plitzi/sdk-shared';

describe('calculateInheriting', () => {
  describe('edge cases', () => {
    describe('defaultStyle deduplication (same componentType in hierarchy)', () => {
      it('should apply defaultStyle only once for nested same-type elements', () => {
        const element: Element = {
          ...baseElement,
          id: 'child',
          definition: {
            ...baseElement.definition,
            parentId: 'parent'
          }
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
              styleSelectors: { base: '' }
            }
          }
        };

        const componentDefinitions = {
          button: {
            defaultStyle: {
              style: {
                base: {
                  default: { color: 'red' }
                }
              }
            }
          }
        } as unknown as Record<string, ComponentDefinition>;

        const result = calculateInheriting(element, undefined, flat, emptyPlatform, componentDefinitions, {
          styleSelector: 'base'
        });

        const colorValues = result.style.color.map(v => v.value);

        // 🔥 should only appear once
        expect(colorValues.filter(v => v === 'red').length).toBe(1);
      });

      it('should still apply defaultStyle if no ancestor of same type exists', () => {
        const element: Element = {
          ...baseElement,
          definition: {
            ...baseElement.definition,
            parentId: 'parent'
          }
        };

        const flat: Schema['flat'] = {
          parent: {
            id: 'parent',
            attributes: {},
            definition: {
              label: 'Parent',
              type: 'div', // 🔥 different type
              rootId: 'parent',
              parentId: undefined,
              styleSelectors: { base: '' }
            }
          }
        };

        const componentDefinitions = {
          button: {
            defaultStyle: {
              style: {
                base: {
                  default: { color: 'red' }
                }
              }
            }
          }
        } as unknown as Record<string, ComponentDefinition>;

        const result = calculateInheriting(element, undefined, flat, emptyPlatform, componentDefinitions, {
          styleSelector: 'base'
        });

        const colorValues = result.style.color.map(v => v.value);

        expect(colorValues.includes('red')).toBe(true);
      });

      it('deep nesting should still only apply one defaultStyle per type chain', () => {
        const flat: Schema['flat'] = {};

        let parentId: string | undefined = undefined;
        for (let i = 0; i < 5; i++) {
          const id = `node${i}`;
          flat[id] = {
            id,
            attributes: {},
            definition: {
              label: id,
              type: 'button',
              rootId: id,
              parentId,
              styleSelectors: { base: '' }
            }
          };
          parentId = id;
        }

        const componentDefinitions = {
          button: {
            defaultStyle: {
              style: {
                base: {
                  default: { color: 'red' }
                }
              }
            }
          }
        } as unknown as Record<string, ComponentDefinition>;

        const result = calculateInheriting(flat['node4'], undefined, flat, emptyPlatform, componentDefinitions, {
          styleSelector: 'base'
        });

        const colorValues = result.style.color.map(v => v.value);

        // 🔥 still only once
        expect(colorValues.filter(v => v === 'red').length).toBe(1);
      });
    });
    describe('defaultStyle filtering by componentType', () => {
      it('defaultStyle from DIFFERENT componentType should only contribute inheritable properties', () => {
        const element: Element = {
          ...baseElement,
          definition: {
            ...baseElement.definition,
            type: 'button',
            parentId: 'card'
          }
        };

        const flat: Schema['flat'] = {
          card: {
            id: 'card',
            attributes: {},
            definition: {
              label: 'Card',
              type: 'card',
              rootId: 'card',
              parentId: undefined,
              styleSelectors: { base: '' }
            }
          }
        };

        const componentDefinitions = {
          card: {
            defaultStyle: {
              style: {
                base: {
                  default: { color: 'blue', display: 'flex', 'background-color': 'white' }
                }
              }
            }
          }
        } as unknown as Record<string, ComponentDefinition>;

        const result = calculateInheriting(element, 'button', flat, emptyPlatform, componentDefinitions, {
          styleSelector: 'base'
        });

        // 🔥 color is inheritable — should appear
        expect(result.style.color).toBeDefined();
        expect(result.style.color[0].value).toBe('blue');

        // 🔥 display and background-color are NOT inheritable — must be filtered
        expect(result.style.display).toBeUndefined();
        expect(result.style['background-color']).toBeUndefined();
      });

      it('defaultStyle from SAME componentType should contribute ALL properties (unfiltered)', () => {
        const element: Element = {
          ...baseElement,
          definition: {
            ...baseElement.definition,
            type: 'button',
            parentId: undefined
          }
        };

        const componentDefinitions = {
          button: {
            defaultStyle: {
              style: {
                base: {
                  default: { color: 'red', display: 'flex', 'background-color': 'white' }
                }
              }
            }
          }
        } as unknown as Record<string, ComponentDefinition>;

        const result = calculateInheriting(element, 'button', {}, emptyPlatform, componentDefinitions, {
          styleSelector: 'base'
        });

        // 🔥 ALL properties should appear — no filtering for same componentType
        expect(result.style.color[0].value).toBe('red');
        expect(result.style.display[0].value).toBe('flex');
        expect(result.style['background-color'][0].value).toBe('white');
      });
    });
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
    it('does not leak state when switching from state to no-state', () => {
      const platform: Style['platform'] = {
        desktop: {
          btn: {
            name: 'btn',
            type: 'class',
            attributes: {
              base: {
                default: { color: 'red' },
                states: { hover: { color: 'blue' } }
              }
            },
            cache: ''
          }
        },
        tablet: {},
        mobile: {}
      };

      const withState = calculateInheriting(baseElement, undefined, {}, platform, undefined, {
        styleSelector: 'base',
        styleState: 'hover',
        includeSelf: true
      });

      const withoutState = calculateInheriting(baseElement, undefined, {}, platform, undefined, {
        styleSelector: 'base',
        includeSelf: true
      });

      expect(withState.style.color[0].value).toBe('blue');
      expect(withoutState.style.color[0].value).toBe('red');
    });
    it('variant should not override when not provided', () => {
      const platform: Style['platform'] = {
        desktop: {
          btn: {
            name: 'btn',
            type: 'class',
            attributes: {
              base: {
                default: { color: 'red' },
                variants: {
                  primary: {
                    default: { color: 'green' }
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
        includeSelf: true
      });

      expect(result.style.color[0].value).toBe('red');
    });
    it('variant + state should fallback to base.state if variant.state missing', () => {
      const platform: Style['platform'] = {
        desktop: {
          btn: {
            name: 'btn',
            type: 'class',
            attributes: {
              base: {
                default: { color: 'red' },
                states: { hover: { color: 'blue' } },
                variants: {
                  primary: {
                    default: { color: 'green' }
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

      expect(result.style.color[0].value).toBe('blue');
    });
    it('does not mutate original attributes (immutability)', () => {
      const attributes = {
        base: {
          default: { color: 'red' }
        }
      };

      const platform: Style['platform'] = {
        desktop: {
          btn: {
            name: 'btn',
            type: 'class',
            attributes,
            cache: ''
          }
        },
        tablet: {},
        mobile: {}
      };

      calculateInheriting(baseElement, undefined, {}, platform, undefined, { includeSelf: true });

      expect(attributes).toEqual({
        base: {
          default: { color: 'red' }
        }
      });
    });
    it('current element keeps all properties, ancestors only inheritable', () => {
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
            attributes: {
              base: {
                default: { position: 'absolute', color: 'purple' }
              }
            },
            cache: ''
          },
          btn: {
            name: 'btn',
            type: 'class',
            attributes: {
              base: {
                default: { position: 'relative', color: 'red' }
              }
            },
            cache: ''
          }
        },
        tablet: {},
        mobile: {}
      };

      const result = calculateInheriting(element, undefined, flat, platform, undefined, { includeSelf: true });

      const positionValues = result.style.position.map(v => v.value);

      expect(positionValues).toContain('relative');
      expect(positionValues).not.toContain('absolute');
      expect(result.style.color.some(v => v.value === 'purple')).toBe(true);
    });
    it('multiple displayModes should not bleed values between modes', () => {
      const platform: Style['platform'] = {
        desktop: {
          btn: {
            name: 'btn',
            type: 'class',
            attributes: { base: { default: { color: 'red' } } },
            cache: ''
          }
        },
        tablet: {
          btn: {
            name: 'btn',
            type: 'class',
            attributes: { base: { default: { color: 'blue' } } },
            cache: ''
          }
        },
        mobile: {
          btn: {
            name: 'btn',
            type: 'class',
            attributes: { base: { default: { color: 'green' } } },
            cache: ''
          }
        }
      };

      const result = calculateInheriting(baseElement, undefined, {}, platform, undefined, { includeSelf: true });

      const values = result.style.color.map(v => v.value);
      expect(values).toContain('red');
      expect(values).toContain('blue');
      expect(values).toContain('green');
    });
  });
});

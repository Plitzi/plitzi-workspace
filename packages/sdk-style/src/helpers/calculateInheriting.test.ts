import { describe, it, expect } from 'vitest';

import calculateInheriting from './calculateInheriting';

import type { ComponentDefinition, Element, Schema, Style } from '@plitzi/sdk-shared';

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

  describe('selectors', () => {
    it('applies base class styles', () => {
      const platform: Style['platform'] = {
        desktop: {
          btn: { name: 'btn', type: 'class', attributes: { base: { default: { color: 'red' } } }, cache: '' }
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
          btn: { name: 'btn', type: 'class', attributes: { base: { default: { color: 'red' } } }, cache: '' }
        },
        tablet: {},
        mobile: {}
      };

      const result = calculateInheriting(baseElement, undefined, {}, platform, { styleSelector: 'base' }, {}, ['btn']);
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

      const result = calculateInheriting(element, undefined, {}, platform);

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

      const result = calculateInheriting(baseElement, undefined, {}, platform);
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

      const result = calculateInheriting(baseElement, undefined, {}, platform, {
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

      const result = calculateInheriting(element, undefined, flat, platform, {
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

        const result = calculateInheriting(
          element,
          undefined,
          flat,
          emptyPlatform,
          { styleSelector: 'base' },
          componentDefinitions
        );

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

        const result = calculateInheriting(
          element,
          undefined,
          flat,
          emptyPlatform,
          { styleSelector: 'base' },
          componentDefinitions
        );

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

        const result = calculateInheriting(
          flat['node4'],
          undefined,
          flat,
          emptyPlatform,
          { styleSelector: 'base' },
          componentDefinitions
        );

        const colorValues = result.style.color.map(v => v.value);

        // 🔥 still only once
        expect(colorValues.filter(v => v === 'red').length).toBe(1);
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

      const withState = calculateInheriting(baseElement, undefined, {}, platform, {
        styleSelector: 'base',
        styleState: 'hover'
      });

      const withoutState = calculateInheriting(baseElement, undefined, {}, platform, {
        styleSelector: 'base'
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

      const result = calculateInheriting(baseElement, undefined, {}, platform, {
        styleSelector: 'base'
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

      const result = calculateInheriting(baseElement, undefined, {}, platform, {
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

      calculateInheriting(baseElement, undefined, {}, platform);

      expect(attributes).toEqual({
        base: {
          default: { color: 'red' }
        }
      });
    });

    it('ancestor styles should not override current non-inheritable values', () => {
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
                default: { position: 'absolute' }
              }
            },
            cache: ''
          },
          btn: {
            name: 'btn',
            type: 'class',
            attributes: {
              base: {
                default: { position: 'relative' }
              }
            },
            cache: ''
          }
        },
        tablet: {},
        mobile: {}
      };

      const result = calculateInheriting(element, undefined, flat, platform);

      expect(result.style.position[result.style.position.length - 1].value).toBe('relative');
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

      const result = calculateInheriting(baseElement, undefined, {}, platform);

      const values = result.style.color.map(v => v.value);
      expect(values).toContain('red');
      expect(values).toContain('blue');
      expect(values).toContain('green');
    });

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

      const result = calculateInheriting(element, undefined, flat, platform, { styleSelector: 'base' }, {}, [
        'parentBtn'
      ]);

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

      const result = calculateInheriting(element, undefined, {}, platform);

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

      const result = calculateInheriting(element, undefined, flat, platform);
      const values = result.style.color.map(v => v.value);

      expect(values[0]).toBe('red');
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

      const result = calculateInheriting(flat['node9'], undefined, flat, platform, {
        styleSelector: 'base'
      });

      // 🔥 first node color wins
      const lastColor = result.style.color[0]?.value;
      expect(lastColor).toBe('color9');
    });
  });
});

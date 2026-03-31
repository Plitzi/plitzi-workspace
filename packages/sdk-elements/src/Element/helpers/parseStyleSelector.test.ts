import { describe, it, expect } from 'vitest';

import parseStyleSelectors from '../helpers/parseStyleSelectors';

import type { Element } from '@plitzi/sdk-shared';

describe('parseStyleSelectors', () => {
  const definitionBase: Element['definition'] = {
    label: 'Button',
    type: 'button',
    rootId: 'root',
    parentId: 'parent',
    styleSelectors: { base: 'main-layout--left icon', header: 'header-item' },
    initialState: {
      styleVariant: {
        button: { base: 'primary' },
        'main-layout--left': { base: 'collapsed' },
        icon: { base: ['sm', 'rounded'] },
        'header-item': { header: 'highlight' }
      }
    }
  };

  it('applies single variant to sub-selector', () => {
    const result = parseStyleSelectors(definitionBase);
    expect(result.base).toContain('button button--primary');
    expect(result.base).toContain('main-layout--left main-layout--left--collapsed');
  });

  it('applies multiple variants to sub-selector', () => {
    const result = parseStyleSelectors(definitionBase);
    expect(result.base).toContain('icon icon--sm icon--rounded');
  });

  it('applies variant for non-base slot', () => {
    const result = parseStyleSelectors(definitionBase);
    expect(result.header).toContain('header-item header-item--highlight');
  });

  it('does not add variant if none defined', () => {
    const def: Element['definition'] = {
      label: 'Button',
      type: 'button',
      rootId: 'root',
      parentId: 'parent',
      styleSelectors: { base: 'footer' },
      initialState: {}
    };
    const result = parseStyleSelectors(def);
    expect(result.base).toBe('plitzi__button footer');
  });

  it('works when selector is already the element type', () => {
    const def = {
      label: 'Button',
      type: 'button',
      rootId: 'root',
      parentId: 'parent',
      styleSelectors: { base: 'button' },
      initialState: {
        styleVariant: { button: { base: 'primary' } }
      }
    };
    const result = parseStyleSelectors(def);
    expect(result.base).toContain('button button--primary');
  });

  it('handles selectors with no variants gracefully', () => {
    const def = {
      label: 'Button',
      type: 'button',
      rootId: 'root',
      parentId: 'parent',
      styleSelectors: { base: 'btn icon' },
      initialState: { styleVariant: { btn: { base: 'primary' } } }
    };
    const result = parseStyleSelectors(def);
    expect(result.base).toContain('btn btn--primary');
    expect(result.base).toContain('icon');
  });

  it('handles multiple slots per selector', () => {
    const def = {
      label: 'Button',
      type: 'button',
      rootId: 'root',
      parentId: 'parent',
      styleSelectors: { base: 'btn' },
      initialState: {
        styleVariant: { btn: { base: 'primary', header: 'secondary' } }
      }
    };
    const result = parseStyleSelectors(def);
    expect(result.base).toContain('btn btn--primary');
    // header variant should not apply to base slot
    expect(result.base).not.toContain('btn--secondary');
  });

  describe('edge cases', () => {
    it('handles empty styleSelectors gracefully', () => {
      const def: Element['definition'] = {
        label: 'Empty',
        type: 'empty',
        rootId: 'root',
        parentId: 'parent',
        styleSelectors: { base: '' },
        initialState: { styleVariant: {} }
      };
      const result = parseStyleSelectors(def);
      expect(result.base).toBe('');
    });

    it('handles undefined styleVariant', () => {
      const def: Element['definition'] = {
        label: 'NoVariant',
        type: 'novar',
        rootId: 'root',
        parentId: 'parent',
        styleSelectors: { base: 'btn icon' }
      };
      const result = parseStyleSelectors(def);
      expect(result.base).toContain('btn');
      expect(result.base).toContain('icon');
    });

    it('handles duplicate selectors in styleSelectors', () => {
      const def: Element['definition'] = {
        label: 'Duplicate',
        type: 'dup',
        rootId: 'root',
        parentId: 'parent',
        styleSelectors: { base: 'btn btn btn' },
        initialState: { styleVariant: { btn: { base: ['primary', 'secondary'] } } }
      };
      const result = parseStyleSelectors(def);
      expect(result.base).toContain('btn btn--primary btn--secondary');
    });

    it('handles multiple slots with same variant name', () => {
      const def: Element['definition'] = {
        label: 'MultipleSlots',
        type: 'multi',
        rootId: 'root',
        parentId: 'parent',
        styleSelectors: { base: 'btn', header: 'btn' },
        initialState: {
          styleVariant: {
            btn: { base: 'primary', header: 'secondary' }
          }
        }
      };
      const result = parseStyleSelectors(def);
      expect(result.base).toContain('btn btn--primary');
      expect(result.header).toContain('btn btn--secondary');
    });

    it('handles multiple spaces in styleSelectors', () => {
      const def: Element['definition'] = {
        label: 'Spaces',
        type: 'spaced',
        rootId: 'root',
        parentId: 'parent',
        styleSelectors: { base: 'btn  icon   footer' },
        initialState: {
          styleVariant: {
            btn: { base: 'primary' },
            icon: { base: 'sm' }
          }
        }
      };
      const result = parseStyleSelectors(def);
      expect(result.base).toContain('btn btn--primary');
      expect(result.base).toContain('icon icon--sm');
      expect(result.base).toContain('footer');
    });

    it('handles selectors that match the element type with no variant', () => {
      const def: Element['definition'] = {
        label: 'MatchType',
        type: 'match',
        rootId: 'root',
        parentId: 'parent',
        styleSelectors: { base: 'match other' },
        initialState: { styleVariant: {} }
      };
      const result = parseStyleSelectors(def);
      expect(result.base).toContain('match');
      expect(result.base).toContain('other');
    });

    it('handles selector with variant undefined for that slot', () => {
      const def: Element['definition'] = {
        label: 'UndefinedSlot',
        type: 'undef',
        rootId: 'root',
        parentId: 'parent',
        styleSelectors: { base: 'btn' },
        initialState: {
          styleVariant: { btn: { header: 'secondary' } } // slot 'base' undefined
        }
      };
      const result = parseStyleSelectors(def);
      expect(result.base).toBe('plitzi__undef btn');
    });
  });
});

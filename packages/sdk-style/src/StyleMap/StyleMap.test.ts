import { describe, it, expect, beforeEach } from 'vitest';

import { StyleVariableCategory } from '@plitzi/sdk-shared';

import StyleMap from './StyleMap';

import type { Style, StyleItem } from '@plitzi/sdk-shared';
import type { StylePlatform } from '@plitzi/sdk-shared';

const createBaseStyle = (): Pick<Style, 'platform' | 'variables'> => ({
  platform: {
    desktop: {},
    tablet: {},
    mobile: {}
  },
  variables: {}
});

describe('StyleMap', () => {
  let style: Pick<Style, 'platform' | 'variables'>;

  beforeEach(() => {
    style = createBaseStyle();
  });

  describe('addSelector (default)', () => {
    it('should add a selector correctly without path', () => {
      const result = StyleMap.addSelector(style, 'desktop', 'button', 'class', undefined, {
        'align-items': 'center'
      });

      expect(result).toBe(true);
      expect(style.platform.desktop.button.attributes['align-items']).toBe('center');

      const result2 = StyleMap.addSelector(style, 'desktop', 'button2', 'class', '', { color: 'red' });
      expect(result2).toBe(true);
      expect(style.platform.desktop.button2.attributes['color']).toBe('red');
    });

    it('should add a selector correctly with path', () => {
      // @ts-expect-error // eslint-disable-line
      const result = StyleMap.addSelector(style, 'desktop', 'button', 'class', 'align-items', {
        'align-items': 'center'
      });

      expect(result).toBe(false);
      expect(style.platform.desktop.button).toBeUndefined();

      const result2 = StyleMap.addSelector(style, 'desktop', 'button', 'class', 'align-items', 'center');
      expect(result2).toBe(true);
      expect(style.platform.desktop.button).toBeDefined();
    });

    it('should not add duplicate selector', () => {
      StyleMap.addSelector(style, 'desktop', 'button', 'class', '', {});

      const result = StyleMap.addSelector(style, 'desktop', 'button', 'class', '', {});

      expect(result).toBe(false);
    });

    it('should not handle deep path', () => {
      // @ts-expect-error // eslint-disable-line
      const result = StyleMap.addSelector(style, 'desktop', 'button', 'class', 'flex.align-items', {
        flex: { 'align-items': 'center' }
      });

      expect(result).toEqual(false);
      expect(style.platform.desktop.button).toBeUndefined();
    });
  });

  describe('addSelector (class-component)', () => {
    it('should add class-component selector', () => {
      const result = StyleMap.addSelector(
        style,
        'desktop',
        'card',
        'class-component',
        '',
        {},
        { componentType: 'div' }
      );

      expect(result).toBe(true);
      expect(style.platform.desktop.card).toBeDefined();

      const result2 = StyleMap.addSelector(
        style,
        'desktop',
        'card2',
        'class-component',
        '',
        {
          base: {
            color: 'red'
          }
        },
        { componentType: 'div' }
      );

      expect(result2).toBe(true);
      expect(style.platform.desktop.card2).toBeDefined();
      expect(
        (style.platform.desktop.card2 as Extract<StyleItem, { type: 'class-component' }>).attributes.base.color
      ).toBe('red');
    });

    it('should require componentType', () => {
      // @ts-expect-error // eslint-disable-line
      const result = StyleMap.addSelector(style, 'desktop', 'card', 'class-component', '', {});

      expect(result).toBe(false);
      expect(style.platform.desktop.card).toBeUndefined();
    });
  });

  describe('getSelector', () => {
    it('should return selector', () => {
      StyleMap.addSelector(style, 'desktop', 'button', 'class', '', {});

      const result = StyleMap.getSelector(style, 'desktop', 'button');

      expect(result?.name).toBe('button');
    });

    it('should return undefined if not found', () => {
      const result = StyleMap.getSelector(style, 'desktop', 'nope');

      expect(result).toBeUndefined();
    });
  });

  describe('updateSelector', () => {
    it('should update attribute', () => {
      StyleMap.addSelector(style, 'desktop', 'button', 'class', '', {});

      const result = StyleMap.updateSelector(style, 'desktop', 'button', 'class', 'align-items', 'center');
      expect(result).toBe(true);
      expect(style.platform.desktop.button.attributes['align-items']).toBe('center');
    });

    it('should remove attribute when value undefined', () => {
      StyleMap.addSelector(style, 'desktop', 'button', 'class', '', {
        'align-items': 'center'
      });

      StyleMap.updateSelector(style, 'desktop', 'button', 'class', 'align-items');

      expect(style.platform.desktop.button.attributes['align-items']).toBeUndefined();
    });

    it('should return false if selector does not exist', () => {
      const result = StyleMap.updateSelector(style, 'desktop', 'nope', 'class', '', {});

      expect(result).toBe(false);
    });
  });

  describe('removeSelector', () => {
    it('should remove selector from specific displayMode', () => {
      StyleMap.addSelector(style, 'desktop', 'button', 'class', '', {});

      const result = StyleMap.removeSelector(style, 'desktop', 'button');

      expect(result).toBe(true);
      expect(style.platform.desktop.button).toBeUndefined();
    });

    it('should remove selector from all displayModes', () => {
      StyleMap.addSelector(style, 'desktop', 'button', 'class', '', {});
      StyleMap.addSelector(style, 'mobile', 'button', 'class', '', {});

      const result = StyleMap.removeSelector(style, undefined, 'button');

      expect(result).toBe(true);
      expect(style.platform.desktop.button).toBeUndefined();
      expect(style.platform.mobile.button).toBeUndefined();
    });

    it('should return false if selector not found', () => {
      const result = StyleMap.removeSelector(style, 'desktop', 'nope');

      expect(result).toBe(false);
    });
  });

  describe('selector variables', () => {
    beforeEach(() => {
      StyleMap.addSelector(style, 'desktop', 'button', 'class', '', {});
    });

    it('should add variable', () => {
      const result = StyleMap.addSelectorVariable(
        style,
        'desktop',
        'button',
        StyleVariableCategory.COLOR,
        'primary',
        '#000'
      );

      expect(result).toBe(true);
      expect(style.platform.desktop.button.variables?.color?.primary).toBe('#000');
    });

    it('should not add duplicate variable', () => {
      StyleMap.addSelectorVariable(style, 'desktop', 'button', StyleVariableCategory.COLOR, 'primary', '#000');

      const result = StyleMap.addSelectorVariable(
        style,
        'desktop',
        'button',
        StyleVariableCategory.COLOR,
        'primary',
        '#111'
      );

      expect(result).toBe(false);
    });

    it('should update variable', () => {
      StyleMap.addSelectorVariable(style, 'desktop', 'button', StyleVariableCategory.COLOR, 'primary', '#000');

      StyleMap.updateSelectorVariable(style, 'desktop', 'button', StyleVariableCategory.COLOR, 'primary', '#111');

      expect(style.platform.desktop.button.variables?.color?.primary).toBe('#111');
    });

    it('should remove variable and cleanup empty objects', () => {
      StyleMap.addSelectorVariable(style, 'desktop', 'button', StyleVariableCategory.COLOR, 'primary', '#000');

      StyleMap.removeSelectorVariable(style, 'desktop', 'button', StyleVariableCategory.COLOR, 'primary');

      expect(style.platform.desktop.button.variables).toBeUndefined();
    });
  });

  describe('global variables', () => {
    it('should add variable', () => {
      const result = StyleMap.addVariable(style, StyleVariableCategory.COLOR, 'primary', '#000');

      expect(result).toBe(true);
      expect(style.variables.color?.primary).toBe('#000');
    });

    it('should not add duplicate variable', () => {
      StyleMap.addVariable(style, StyleVariableCategory.COLOR, 'primary', '#000');

      const result = StyleMap.addVariable(style, StyleVariableCategory.COLOR, 'primary', '#111');

      expect(result).toBe(false);
    });

    it('should update variable', () => {
      StyleMap.addVariable(style, StyleVariableCategory.COLOR, 'primary', '#000');

      StyleMap.updateVariable(style, StyleVariableCategory.COLOR, 'primary', '#111');

      expect(style.variables.color?.primary).toBe('#111');
    });

    it('should remove variable and cleanup', () => {
      StyleMap.addVariable(style, StyleVariableCategory.COLOR, 'primary', '#000');

      StyleMap.removeVariable(style, StyleVariableCategory.COLOR, 'primary');

      expect(style.variables.color).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('should not crash with empty style', () => {
      const empty = { platform: {} as StylePlatform, variables: {} };

      expect(() => {
        StyleMap.getSelector(empty, 'desktop', 'button');
      }).not.toThrow();
    });

    it('should regenerate cache on update', () => {
      StyleMap.addSelector(style, 'desktop', 'button', 'class', '', {});

      const before = style.platform.desktop.button.cache;

      StyleMap.updateSelector(style, 'desktop', 'button', 'class', 'align-items', 'center');

      const after = style.platform.desktop.button.cache;

      expect(after).not.toBe(before);
    });
  });
});

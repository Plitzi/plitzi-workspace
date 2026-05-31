import { describe, it, expect } from 'vitest';

import createStyleSelectorTool from './createStyleSelector';
import deleteStyleSelectorTool from './deleteStyleSelector';
import updateStyleSelectorTool from './updateStyleSelector';

const validSelector = { displayMode: 'desktop', selector: '.hero', type: 'class' };

describe('createStyleSelectorTool', () => {
  it('has correct name and adapterName', () => {
    expect(createStyleSelectorTool.name).toBe('create_style_selector');
    expect(createStyleSelectorTool.adapterName).toBe('createStyleSelector');
  });

  it('allows only build mode (write)', () => {
    expect(createStyleSelectorTool.definition.allowedModes).toEqual(['build']);
  });

  describe('inputSchema', () => {
    it('accepts required fields', () => {
      expect(
        createStyleSelectorTool.mcpDefinition.inputSchema?.safeParse({
          displayMode: 'desktop',
          selector: '.hero',
          type: 'class'
        }).success
      ).toBe(true);
    });

    it('accepts all optional fields', () => {
      expect(
        createStyleSelectorTool.mcpDefinition.inputSchema?.safeParse({
          displayMode: 'mobile',
          selector: 'button',
          type: 'element',
          style: { base: { backgroundColor: '#3b82f6' } }
        }).success
      ).toBe(true);
    });

    it('rejects invalid displayMode', () => {
      expect(
        createStyleSelectorTool.mcpDefinition.inputSchema?.safeParse({
          displayMode: 'widescreen',
          selector: '.hero',
          type: 'class'
        }).success
      ).toBe(false);
    });

    it('rejects invalid type', () => {
      expect(
        createStyleSelectorTool.mcpDefinition.inputSchema?.safeParse({
          displayMode: 'desktop',
          selector: '.hero',
          type: 'attribute'
        }).success
      ).toBe(false);
    });

    it('rejects missing selector', () => {
      expect(
        createStyleSelectorTool.mcpDefinition.inputSchema?.safeParse({ displayMode: 'desktop', type: 'class' }).success
      ).toBe(false);
    });
  });

  describe('outputSchema', () => {
    it('validates created selector', () => {
      expect(createStyleSelectorTool.mcpDefinition.outputSchema?.safeParse(validSelector).success).toBe(true);
    });
  });
});

describe('updateStyleSelectorTool', () => {
  it('has correct name and adapterName', () => {
    expect(updateStyleSelectorTool.name).toBe('update_style_selector');
    expect(updateStyleSelectorTool.adapterName).toBe('updateStyleSelector');
  });

  it('allows only build mode (write)', () => {
    expect(updateStyleSelectorTool.definition.allowedModes).toEqual(['build']);
  });

  describe('inputSchema', () => {
    it('accepts required fields', () => {
      expect(
        updateStyleSelectorTool.mcpDefinition.inputSchema?.safeParse({
          displayMode: 'desktop',
          selector: '.hero',
          type: 'class'
        }).success
      ).toBe(true);
    });

    it('accepts optional path and style', () => {
      expect(
        updateStyleSelectorTool.mcpDefinition.inputSchema?.safeParse({
          displayMode: 'tablet',
          selector: '.hero',
          type: 'class',
          path: 'base.backgroundColor',
          style: { base: { color: '#fff' } }
        }).success
      ).toBe(true);
    });

    it('rejects invalid displayMode', () => {
      expect(
        updateStyleSelectorTool.mcpDefinition.inputSchema?.safeParse({
          displayMode: 'xl',
          selector: '.hero',
          type: 'class'
        }).success
      ).toBe(false);
    });
  });

  describe('outputSchema', () => {
    it('validates updated selector', () => {
      expect(updateStyleSelectorTool.mcpDefinition.outputSchema?.safeParse(validSelector).success).toBe(true);
    });
  });
});

describe('deleteStyleSelectorTool', () => {
  it('has correct name and adapterName', () => {
    expect(deleteStyleSelectorTool.name).toBe('delete_style_selector');
    expect(deleteStyleSelectorTool.adapterName).toBe('deleteStyleSelector');
  });

  it('allows only build mode (write)', () => {
    expect(deleteStyleSelectorTool.definition.allowedModes).toEqual(['build']);
  });

  describe('inputSchema', () => {
    it('accepts displayMode and selector', () => {
      expect(
        deleteStyleSelectorTool.mcpDefinition.inputSchema?.safeParse({ displayMode: 'desktop', selector: '.hero' })
          .success
      ).toBe(true);
    });

    it('rejects missing selector', () => {
      expect(deleteStyleSelectorTool.mcpDefinition.inputSchema?.safeParse({ displayMode: 'desktop' }).success).toBe(
        false
      );
    });

    it('rejects invalid displayMode', () => {
      expect(
        deleteStyleSelectorTool.mcpDefinition.inputSchema?.safeParse({ displayMode: '4k', selector: '.x' }).success
      ).toBe(false);
    });
  });

  describe('outputSchema', () => {
    it('validates data: true', () => {
      expect(deleteStyleSelectorTool.mcpDefinition.outputSchema?.safeParse(true).success).toBe(true);
    });
  });
});

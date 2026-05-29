import { describe, it, expect } from 'vitest';

import createStyleVariableTool from './createStyleVariable';
import deleteStyleVariableTool from './deleteStyleVariable';
import updateStyleVariableTool from './updateStyleVariable';

const validStyleVariable = { category: 'color', name: 'primary', value: '#3b82f6' };

describe('createStyleVariableTool', () => {
  it('has correct name and adapterName', () => {
    expect(createStyleVariableTool.name).toBe('create_style_variable');
    expect(createStyleVariableTool.adapterName).toBe('createStyleVariable');
  });

  it('allows only build mode (write)', () => {
    expect(createStyleVariableTool.definition.allowedModes).toEqual(['build']);
  });

  describe('inputSchema', () => {
    it('accepts category, name, and string value', () => {
      expect(
        createStyleVariableTool.mcpDefinition.inputSchema.safeParse({ category: 'color', name: 'primary', value: '#3b82f6' }).success
      ).toBe(true);
    });

    it('accepts theme-aware object value', () => {
      expect(
        createStyleVariableTool.mcpDefinition.inputSchema.safeParse({
          category: 'color',
          name: 'primary',
          value: { light: '#3b82f6', dark: '#60a5fa', default: '#3b82f6' }
        }).success
      ).toBe(true);
    });

    it('accepts spacing category', () => {
      expect(
        createStyleVariableTool.mcpDefinition.inputSchema.safeParse({ category: 'spacing', name: 'md', value: '16px' }).success
      ).toBe(true);
    });

    it('rejects invalid category', () => {
      expect(
        createStyleVariableTool.mcpDefinition.inputSchema.safeParse({ category: 'unknown', name: 'x', value: '#000' }).success
      ).toBe(false);
    });

    it('rejects missing name', () => {
      expect(
        createStyleVariableTool.mcpDefinition.inputSchema.safeParse({ category: 'color', value: '#000' }).success
      ).toBe(false);
    });
  });

  describe('outputSchema', () => {
    it('validates created style variable', () => {
      expect(createStyleVariableTool.mcpDefinition.outputSchema.safeParse({ data: validStyleVariable }).success).toBe(true);
    });
  });
});

describe('updateStyleVariableTool', () => {
  it('has correct name and adapterName', () => {
    expect(updateStyleVariableTool.name).toBe('update_style_variable');
    expect(updateStyleVariableTool.adapterName).toBe('updateStyleVariable');
  });

  it('allows only build mode (write)', () => {
    expect(updateStyleVariableTool.definition.allowedModes).toEqual(['build']);
  });

  describe('inputSchema', () => {
    it('accepts required fields', () => {
      expect(
        updateStyleVariableTool.mcpDefinition.inputSchema.safeParse({
          category: 'color',
          name: 'primary',
          value: '#60a5fa'
        }).success
      ).toBe(true);
    });

    it('rejects missing name', () => {
      expect(
        updateStyleVariableTool.mcpDefinition.inputSchema.safeParse({ category: 'color', value: '#000' }).success
      ).toBe(false);
    });
  });

  describe('outputSchema', () => {
    it('validates updated style variable', () => {
      expect(updateStyleVariableTool.mcpDefinition.outputSchema.safeParse({ data: validStyleVariable }).success).toBe(true);
    });
  });
});

describe('deleteStyleVariableTool', () => {
  it('has correct name and adapterName', () => {
    expect(deleteStyleVariableTool.name).toBe('delete_style_variable');
    expect(deleteStyleVariableTool.adapterName).toBe('deleteStyleVariable');
  });

  it('allows only build mode (write)', () => {
    expect(deleteStyleVariableTool.definition.allowedModes).toEqual(['build']);
  });

  describe('inputSchema', () => {
    it('accepts category and name', () => {
      expect(
        deleteStyleVariableTool.mcpDefinition.inputSchema.safeParse({ category: 'color', name: 'primary' }).success
      ).toBe(true);
    });

    it('rejects missing name', () => {
      expect(
        deleteStyleVariableTool.mcpDefinition.inputSchema.safeParse({ category: 'color' }).success
      ).toBe(false);
    });

    it('rejects invalid category', () => {
      expect(
        deleteStyleVariableTool.mcpDefinition.inputSchema.safeParse({ category: 'bad', name: 'x' }).success
      ).toBe(false);
    });
  });

  describe('outputSchema', () => {
    it('validates data: true', () => {
      expect(deleteStyleVariableTool.mcpDefinition.outputSchema.safeParse({ data: true }).success).toBe(true);
    });
  });
});

import { describe, it, expect } from 'vitest';

import createVariableTool from './createVariable';
import deleteVariableTool from './deleteVariable';
import updateVariableTool from './updateVariable';

const validVariable = { name: 'primaryColor', type: 'color', value: '#3b82f6', category: 'Colors' };

describe('createVariableTool', () => {
  it('has correct name and adapterName', () => {
    expect(createVariableTool.name).toBe('create_variable');
    expect(createVariableTool.adapterName).toBe('createSchemaVariable');
  });

  it('allows only build mode (write)', () => {
    expect(createVariableTool.definition.allowedModes).toEqual(['build']);
  });

  describe('inputSchema', () => {
    it('accepts a valid variable', () => {
      expect(createVariableTool.mcpDefinition.inputSchema?.safeParse({ variable: validVariable }).success).toBe(true);
    });

    it('rejects invalid type', () => {
      expect(
        createVariableTool.mcpDefinition.inputSchema?.safeParse({
          variable: { ...validVariable, type: 'invalid' }
        }).success
      ).toBe(false);
    });

    it('rejects missing variable.name', () => {
      expect(
        createVariableTool.mcpDefinition.inputSchema?.safeParse({
          variable: { type: 'text', value: 'x', category: 'General' }
        }).success
      ).toBe(false);
    });
  });

  describe('outputSchema', () => {
    it('validates created variable', () => {
      expect(createVariableTool.mcpDefinition.outputSchema?.safeParse(validVariable).success).toBe(true);
    });
  });
});

describe('updateVariableTool', () => {
  it('has correct name and adapterName', () => {
    expect(updateVariableTool.name).toBe('update_variable');
    expect(updateVariableTool.adapterName).toBe('updateSchemaVariable');
  });

  it('allows only build mode (write)', () => {
    expect(updateVariableTool.definition.allowedModes).toEqual(['build']);
  });

  describe('inputSchema', () => {
    it('accepts variable name with partial update fields', () => {
      expect(
        updateVariableTool.mcpDefinition.inputSchema?.safeParse({
          variable: { name: 'primaryColor', value: '#000' }
        }).success
      ).toBe(true);
    });

    it('rejects missing variable.name', () => {
      expect(updateVariableTool.mcpDefinition.inputSchema?.safeParse({ variable: { value: '#000' } }).success).toBe(
        false
      );
    });
  });

  describe('outputSchema', () => {
    it('validates updated variable', () => {
      expect(updateVariableTool.mcpDefinition.outputSchema?.safeParse(validVariable).success).toBe(true);
    });
  });
});

describe('deleteVariableTool', () => {
  it('has correct name and adapterName', () => {
    expect(deleteVariableTool.name).toBe('delete_variable');
    expect(deleteVariableTool.adapterName).toBe('deleteSchemaVariable');
  });

  it('allows only build mode (write)', () => {
    expect(deleteVariableTool.definition.allowedModes).toEqual(['build']);
  });

  describe('inputSchema', () => {
    it('accepts variable name', () => {
      expect(deleteVariableTool.mcpDefinition.inputSchema?.safeParse({ name: 'primaryColor' }).success).toBe(true);
    });

    it('rejects missing name', () => {
      expect(deleteVariableTool.mcpDefinition.inputSchema?.safeParse({}).success).toBe(false);
    });
  });

  describe('outputSchema', () => {
    it('validates data: true', () => {
      expect(deleteVariableTool.mcpDefinition.outputSchema?.safeParse(true).success).toBe(true);
    });
  });
});

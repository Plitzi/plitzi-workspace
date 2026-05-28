import { describe, it, expect } from 'vitest';

import createSegmentVariableTool from './createSegmentVariable';
import deleteSegmentVariableTool from './deleteSegmentVariable';
import updateSegmentVariableTool from './updateSegmentVariable';

const validVariable = { name: 'title', type: 'text', value: 'Hello', category: 'Content' };

describe('createSegmentVariableTool', () => {
  it('has correct name and adapterName', () => {
    expect(createSegmentVariableTool.name).toBe('create_segment_variable');
    expect(createSegmentVariableTool.adapterName).toBe('createSegmentVariable');
  });

  it('allows only build mode (write)', () => {
    expect(createSegmentVariableTool.definition.allowedModes).toEqual(['build']);
  });

  describe('inputSchema', () => {
    it('accepts segmentId and valid variable', () => {
      expect(
        createSegmentVariableTool.mcpDefinition.inputSchema.safeParse({ segmentId: 'seg-1', variable: validVariable }).success
      ).toBe(true);
    });

    it('rejects missing segmentId', () => {
      expect(
        createSegmentVariableTool.mcpDefinition.inputSchema.safeParse({ variable: validVariable }).success
      ).toBe(false);
    });

    it('rejects invalid variable type', () => {
      expect(
        createSegmentVariableTool.mcpDefinition.inputSchema.safeParse({
          segmentId: 'seg-1',
          variable: { ...validVariable, type: 'invalid' }
        }).success
      ).toBe(false);
    });
  });

  describe('outputSchema', () => {
    it('validates created variable', () => {
      expect(
        createSegmentVariableTool.mcpDefinition.outputSchema.safeParse({ data: validVariable }).success
      ).toBe(true);
    });
  });
});

describe('updateSegmentVariableTool', () => {
  it('has correct name and adapterName', () => {
    expect(updateSegmentVariableTool.name).toBe('update_segment_variable');
    expect(updateSegmentVariableTool.adapterName).toBe('updateSegmentVariable');
  });

  it('allows only build mode (write)', () => {
    expect(updateSegmentVariableTool.definition.allowedModes).toEqual(['build']);
  });

  describe('inputSchema', () => {
    it('accepts segmentId and variable with name', () => {
      expect(
        updateSegmentVariableTool.mcpDefinition.inputSchema.safeParse({
          segmentId: 'seg-1',
          variable: { name: 'title', value: 'World' }
        }).success
      ).toBe(true);
    });

    it('rejects variable without name', () => {
      expect(
        updateSegmentVariableTool.mcpDefinition.inputSchema.safeParse({
          segmentId: 'seg-1',
          variable: { value: 'World' }
        }).success
      ).toBe(false);
    });
  });

  describe('outputSchema', () => {
    it('validates updated variable', () => {
      expect(
        updateSegmentVariableTool.mcpDefinition.outputSchema.safeParse({ data: validVariable }).success
      ).toBe(true);
    });
  });
});

describe('deleteSegmentVariableTool', () => {
  it('has correct name and adapterName', () => {
    expect(deleteSegmentVariableTool.name).toBe('delete_segment_variable');
    expect(deleteSegmentVariableTool.adapterName).toBe('deleteSegmentVariable');
  });

  it('allows only build mode (write)', () => {
    expect(deleteSegmentVariableTool.definition.allowedModes).toEqual(['build']);
  });

  describe('inputSchema', () => {
    it('accepts segmentId and name', () => {
      expect(
        deleteSegmentVariableTool.mcpDefinition.inputSchema.safeParse({ segmentId: 'seg-1', name: 'title' }).success
      ).toBe(true);
    });

    it('rejects missing name', () => {
      expect(
        deleteSegmentVariableTool.mcpDefinition.inputSchema.safeParse({ segmentId: 'seg-1' }).success
      ).toBe(false);
    });
  });

  describe('outputSchema', () => {
    it('validates data: true', () => {
      expect(deleteSegmentVariableTool.mcpDefinition.outputSchema.safeParse({ data: true }).success).toBe(true);
    });
  });
});

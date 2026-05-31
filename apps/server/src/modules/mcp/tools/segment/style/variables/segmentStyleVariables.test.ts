import { describe, it, expect } from 'vitest';

import createSegmentStyleVariableTool from './createSegmentStyleVariable';
import deleteSegmentStyleVariableTool from './deleteSegmentStyleVariable';
import updateSegmentStyleVariableTool from './updateSegmentStyleVariable';

const validStyleVar = { category: 'color', name: 'accent', value: '#f59e0b' };

describe('createSegmentStyleVariableTool', () => {
  it('has correct name and adapterName', () => {
    expect(createSegmentStyleVariableTool.name).toBe('create_segment_style_variable');
    expect(createSegmentStyleVariableTool.adapterName).toBe('createSegmentStyleVariable');
  });

  it('allows only build mode (write)', () => {
    expect(createSegmentStyleVariableTool.definition.allowedModes).toEqual(['build']);
  });

  describe('inputSchema', () => {
    it('accepts segmentId, category, name, and value', () => {
      expect(
        createSegmentStyleVariableTool.mcpDefinition.inputSchema?.safeParse({
          segmentId: 'seg-1',
          category: 'color',
          name: 'accent',
          value: '#f59e0b'
        }).success
      ).toBe(true);
    });

    it('accepts theme-aware object value', () => {
      expect(
        createSegmentStyleVariableTool.mcpDefinition.inputSchema?.safeParse({
          segmentId: 'seg-1',
          category: 'color',
          name: 'bg',
          value: { light: '#fff', dark: '#000', default: '#fff' }
        }).success
      ).toBe(true);
    });

    it('rejects invalid category', () => {
      expect(
        createSegmentStyleVariableTool.mcpDefinition.inputSchema?.safeParse({
          segmentId: 'seg-1',
          category: 'gradient',
          name: 'x',
          value: '#000'
        }).success
      ).toBe(false);
    });

    it('rejects missing segmentId', () => {
      expect(
        createSegmentStyleVariableTool.mcpDefinition.inputSchema?.safeParse({
          category: 'color',
          name: 'x',
          value: '#000'
        }).success
      ).toBe(false);
    });
  });

  describe('outputSchema', () => {
    it('validates created style variable', () => {
      expect(createSegmentStyleVariableTool.mcpDefinition.outputSchema?.safeParse(validStyleVar).success).toBe(true);
    });
  });
});

describe('updateSegmentStyleVariableTool', () => {
  it('has correct name and adapterName', () => {
    expect(updateSegmentStyleVariableTool.name).toBe('update_segment_style_variable');
    expect(updateSegmentStyleVariableTool.adapterName).toBe('updateSegmentStyleVariable');
  });

  it('allows only build mode (write)', () => {
    expect(updateSegmentStyleVariableTool.definition.allowedModes).toEqual(['build']);
  });

  describe('inputSchema', () => {
    it('accepts required fields', () => {
      expect(
        updateSegmentStyleVariableTool.mcpDefinition.inputSchema?.safeParse({
          segmentId: 'seg-1',
          category: 'color',
          name: 'accent',
          value: '#ef4444'
        }).success
      ).toBe(true);
    });

    it('rejects invalid category', () => {
      expect(
        updateSegmentStyleVariableTool.mcpDefinition.inputSchema?.safeParse({
          segmentId: 'seg-1',
          category: 'font',
          name: 'x',
          value: '#000'
        }).success
      ).toBe(false);
    });
  });

  describe('outputSchema', () => {
    it('validates updated style variable', () => {
      expect(updateSegmentStyleVariableTool.mcpDefinition.outputSchema?.safeParse(validStyleVar).success).toBe(true);
    });
  });
});

describe('deleteSegmentStyleVariableTool', () => {
  it('has correct name and adapterName', () => {
    expect(deleteSegmentStyleVariableTool.name).toBe('delete_segment_style_variable');
    expect(deleteSegmentStyleVariableTool.adapterName).toBe('deleteSegmentStyleVariable');
  });

  it('allows only build mode (write)', () => {
    expect(deleteSegmentStyleVariableTool.definition.allowedModes).toEqual(['build']);
  });

  describe('inputSchema', () => {
    it('accepts segmentId, category and name', () => {
      expect(
        deleteSegmentStyleVariableTool.mcpDefinition.inputSchema?.safeParse({
          segmentId: 'seg-1',
          category: 'color',
          name: 'accent'
        }).success
      ).toBe(true);
    });

    it('rejects missing name', () => {
      expect(
        deleteSegmentStyleVariableTool.mcpDefinition.inputSchema?.safeParse({
          segmentId: 'seg-1',
          category: 'color'
        }).success
      ).toBe(false);
    });
  });

  describe('outputSchema', () => {
    it('validates data: true', () => {
      expect(deleteSegmentStyleVariableTool.mcpDefinition.outputSchema?.safeParse(true).success).toBe(true);
    });
  });
});

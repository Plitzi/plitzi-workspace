import { describe, it, expect } from 'vitest';

import createSegmentTool from './createSegment';
import deleteSegmentTool from './deleteSegment';
import updateSegmentTool from './updateSegment';

const validSegment = {
  identifier: 'hero-card',
  definition: { name: 'Hero Card', description: 'A reusable hero block', baseElementId: 'root-1' }
};

describe('createSegmentTool', () => {
  it('has correct name and adapterName', () => {
    expect(createSegmentTool.name).toBe('create_segment');
    expect(createSegmentTool.adapterName).toBe('createSegment');
  });

  it('allows only build mode (write)', () => {
    expect(createSegmentTool.definition.allowedModes).toEqual(['build']);
  });

  describe('inputSchema', () => {
    it('accepts name and description', () => {
      expect(
        createSegmentTool.mcpDefinition.inputSchema.safeParse({ name: 'Hero Card', description: 'A hero block' }).success
      ).toBe(true);
    });

    it('rejects missing name', () => {
      expect(
        createSegmentTool.mcpDefinition.inputSchema.safeParse({ description: 'A hero block' }).success
      ).toBe(false);
    });

    it('rejects missing description', () => {
      expect(
        createSegmentTool.mcpDefinition.inputSchema.safeParse({ name: 'Hero Card' }).success
      ).toBe(false);
    });
  });

  describe('outputSchema', () => {
    it('validates a created segment', () => {
      expect(createSegmentTool.mcpDefinition.outputSchema.safeParse({ data: validSegment }).success).toBe(true);
    });
  });
});

describe('updateSegmentTool', () => {
  it('has correct name and adapterName', () => {
    expect(updateSegmentTool.name).toBe('update_segment');
    expect(updateSegmentTool.adapterName).toBe('updateSegment');
  });

  it('allows only build mode (write)', () => {
    expect(updateSegmentTool.definition.allowedModes).toEqual(['build']);
  });

  describe('inputSchema', () => {
    it('accepts segmentId and partial updates', () => {
      expect(
        updateSegmentTool.mcpDefinition.inputSchema.safeParse({
          segmentId: 'seg-1',
          updates: { name: 'Updated Hero' }
        }).success
      ).toBe(true);
    });

    it('rejects missing segmentId', () => {
      expect(
        updateSegmentTool.mcpDefinition.inputSchema.safeParse({ updates: { name: 'New' } }).success
      ).toBe(false);
    });

    it('rejects missing updates', () => {
      expect(updateSegmentTool.mcpDefinition.inputSchema.safeParse({ segmentId: 'seg-1' }).success).toBe(false);
    });
  });

  describe('outputSchema', () => {
    it('validates an updated segment', () => {
      expect(updateSegmentTool.mcpDefinition.outputSchema.safeParse({ data: validSegment }).success).toBe(true);
    });
  });
});

describe('deleteSegmentTool', () => {
  it('has correct name and adapterName', () => {
    expect(deleteSegmentTool.name).toBe('delete_segment');
    expect(deleteSegmentTool.adapterName).toBe('deleteSegment');
  });

  it('allows only build mode (write)', () => {
    expect(deleteSegmentTool.definition.allowedModes).toEqual(['build']);
  });

  describe('inputSchema', () => {
    it('accepts segmentId', () => {
      expect(deleteSegmentTool.mcpDefinition.inputSchema.safeParse({ segmentId: 'seg-1' }).success).toBe(true);
    });

    it('rejects missing segmentId', () => {
      expect(deleteSegmentTool.mcpDefinition.inputSchema.safeParse({}).success).toBe(false);
    });
  });

  describe('outputSchema', () => {
    it('validates data: true', () => {
      expect(deleteSegmentTool.mcpDefinition.outputSchema.safeParse({ data: true }).success).toBe(true);
    });
  });
});

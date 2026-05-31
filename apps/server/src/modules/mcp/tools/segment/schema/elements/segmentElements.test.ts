import { describe, it, expect } from 'vitest';

import createSegmentElementTool from './createSegmentElement';
import deleteSegmentElementTool from './deleteSegmentElement';
import moveSegmentElementTool from './moveSegmentElement';
import updateSegmentElementTool from './updateSegmentElement';

const validSegmentElement = { id: 'sel-1', data: { id: 'sel-1' } };

describe('createSegmentElementTool', () => {
  it('has correct name and adapterName', () => {
    expect(createSegmentElementTool.name).toBe('create_segment_element');
    expect(createSegmentElementTool.adapterName).toBe('createSegmentElement');
  });

  it('allows only build mode (write)', () => {
    expect(createSegmentElementTool.definition.allowedModes).toEqual(['build']);
  });

  describe('inputSchema', () => {
    it('accepts required fields', () => {
      expect(
        createSegmentElementTool.mcpDefinition.inputSchema?.safeParse({
          segmentId: 'seg-1',
          element: { type: 'div', label: 'Box' },
          parentId: 'root-1'
        }).success
      ).toBe(true);
    });

    it('rejects missing segmentId', () => {
      expect(
        createSegmentElementTool.mcpDefinition.inputSchema?.safeParse({
          element: { type: 'div', label: 'Box' },
          parentId: 'root-1'
        }).success
      ).toBe(false);
    });

    it('rejects missing parentId', () => {
      expect(
        createSegmentElementTool.mcpDefinition.inputSchema?.safeParse({
          segmentId: 'seg-1',
          element: { type: 'div', label: 'Box' }
        }).success
      ).toBe(false);
    });

    it('rejects element missing type', () => {
      expect(
        createSegmentElementTool.mcpDefinition.inputSchema?.safeParse({
          segmentId: 'seg-1',
          element: { label: 'Box' },
          parentId: 'root-1'
        }).success
      ).toBe(false);
    });
  });

  describe('outputSchema', () => {
    it('validates created segment element', () => {
      expect(createSegmentElementTool.mcpDefinition.outputSchema?.safeParse({ id: 'sel-1' }).success).toBe(true);
    });
  });
});

describe('updateSegmentElementTool', () => {
  it('has correct name and adapterName', () => {
    expect(updateSegmentElementTool.name).toBe('update_segment_element');
    expect(updateSegmentElementTool.adapterName).toBe('updateSegmentElement');
  });

  it('allows only build mode (write)', () => {
    expect(updateSegmentElementTool.definition.allowedModes).toEqual(['build']);
  });

  describe('inputSchema', () => {
    it('accepts segmentId, elementId and updates', () => {
      expect(
        updateSegmentElementTool.mcpDefinition.inputSchema?.safeParse({
          segmentId: 'seg-1',
          elementId: 'el-1',
          updates: { label: 'New Label' }
        }).success
      ).toBe(true);
    });

    it('rejects missing elementId', () => {
      expect(
        updateSegmentElementTool.mcpDefinition.inputSchema?.safeParse({
          segmentId: 'seg-1',
          updates: { label: 'New' }
        }).success
      ).toBe(false);
    });
  });

  describe('outputSchema', () => {
    it('validates updated segment element', () => {
      expect(updateSegmentElementTool.mcpDefinition.outputSchema?.safeParse({ id: 'el-1' }).success).toBe(true);
    });
  });
});

describe('deleteSegmentElementTool', () => {
  it('has correct name and adapterName', () => {
    expect(deleteSegmentElementTool.name).toBe('delete_segment_element');
    expect(deleteSegmentElementTool.adapterName).toBe('deleteSegmentElement');
  });

  it('allows only build mode (write)', () => {
    expect(deleteSegmentElementTool.definition.allowedModes).toEqual(['build']);
  });

  describe('inputSchema', () => {
    it('accepts segmentId and elementId', () => {
      expect(
        deleteSegmentElementTool.mcpDefinition.inputSchema?.safeParse({ segmentId: 'seg-1', elementId: 'el-1' }).success
      ).toBe(true);
    });

    it('rejects missing elementId', () => {
      expect(deleteSegmentElementTool.mcpDefinition.inputSchema?.safeParse({ segmentId: 'seg-1' }).success).toBe(false);
    });
  });

  describe('outputSchema', () => {
    it('validates data: true', () => {
      expect(deleteSegmentElementTool.mcpDefinition.outputSchema?.safeParse(true).success).toBe(true);
    });
  });
});

describe('moveSegmentElementTool', () => {
  it('has correct name and adapterName', () => {
    expect(moveSegmentElementTool.name).toBe('move_segment_element');
    expect(moveSegmentElementTool.adapterName).toBe('moveSegmentElement');
  });

  it('allows only build mode (write)', () => {
    expect(moveSegmentElementTool.definition.allowedModes).toEqual(['build']);
  });

  describe('inputSchema', () => {
    it('accepts required fields', () => {
      expect(
        moveSegmentElementTool.mcpDefinition.inputSchema?.safeParse({
          segmentId: 'seg-1',
          elementId: 'el-1',
          toParentId: 'root-1'
        }).success
      ).toBe(true);
    });

    it('accepts optional dropPosition', () => {
      expect(
        moveSegmentElementTool.mcpDefinition.inputSchema?.safeParse({
          segmentId: 'seg-1',
          elementId: 'el-1',
          toParentId: 'root-1',
          dropPosition: 'top'
        }).success
      ).toBe(true);
    });

    it('rejects invalid dropPosition', () => {
      expect(
        moveSegmentElementTool.mcpDefinition.inputSchema?.safeParse({
          segmentId: 'seg-1',
          elementId: 'el-1',
          toParentId: 'root-1',
          dropPosition: 'center'
        }).success
      ).toBe(false);
    });
  });

  describe('outputSchema', () => {
    it('validates data: true', () => {
      expect(moveSegmentElementTool.mcpDefinition.outputSchema?.safeParse(true).success).toBe(true);
    });
  });
});

// Suppress unused variable warning
void validSegmentElement;

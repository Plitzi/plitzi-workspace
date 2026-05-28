import { describe, it, expect } from 'vitest';

import createElementTool from './createElement';
import deleteElementTool from './deleteElement';
import getElementTool from './getElement';
import listElementsTool from './listElements';
import moveElementTool from './moveElement';
import updateElementTool from './updateElement';

const validElement = {
  id: 'el-1',
  attributes: { class: 'hero' },
  definition: {
    rootId: 'el-1',
    label: 'Hero Section',
    type: 'div',
    styleSelectors: { base: 'sel-1' }
  }
};

describe('createElementTool', () => {
  it('has correct name and adapterName', () => {
    expect(createElementTool.name).toBe('create_element');
    expect(createElementTool.adapterName).toBe('createElement');
  });

  it('allows only build mode (write)', () => {
    expect(createElementTool.definition.allowedModes).toEqual(['build']);
  });

  describe('inputSchema', () => {
    it('accepts minimal element (type + label)', () => {
      const result = createElementTool.mcpDefinition.inputSchema.safeParse({
        element: { type: 'div', label: 'Box' }
      });

      expect(result.success).toBe(true);
    });

    it('accepts full input with all optional fields', () => {
      const result = createElementTool.mcpDefinition.inputSchema.safeParse({
        element: { type: 'div', label: 'Box', props: { class: 'hero' }, runtime: 'client' },
        parentId: 'page-1',
        position: 0
      });

      expect(result.success).toBe(true);
    });

    it('rejects element missing type', () => {
      expect(createElementTool.mcpDefinition.inputSchema.safeParse({ element: { label: 'Box' } }).success).toBe(false);
    });

    it('rejects element missing label', () => {
      expect(createElementTool.mcpDefinition.inputSchema.safeParse({ element: { type: 'div' } }).success).toBe(false);
    });

    it('rejects invalid runtime value', () => {
      expect(
        createElementTool.mcpDefinition.inputSchema.safeParse({
          element: { type: 'div', label: 'Box', runtime: 'worker' }
        }).success
      ).toBe(false);
    });
  });

  describe('outputSchema', () => {
    it('validates a created element', () => {
      expect(createElementTool.mcpDefinition.outputSchema.safeParse({ data: validElement }).success).toBe(true);
    });
  });
});

describe('updateElementTool', () => {
  it('has correct name and adapterName', () => {
    expect(updateElementTool.name).toBe('update_element');
    expect(updateElementTool.adapterName).toBe('updateElement');
  });

  it('allows only build mode (write)', () => {
    expect(updateElementTool.definition.allowedModes).toEqual(['build']);
  });

  describe('inputSchema', () => {
    it('accepts elementId with partial updates', () => {
      const result = updateElementTool.mcpDefinition.inputSchema.safeParse({
        elementId: 'el-1',
        updates: { label: 'New Label' }
      });

      expect(result.success).toBe(true);
    });

    it('accepts runtime update', () => {
      expect(
        updateElementTool.mcpDefinition.inputSchema.safeParse({
          elementId: 'el-1',
          updates: { runtime: 'server' }
        }).success
      ).toBe(true);
    });

    it('rejects missing elementId', () => {
      expect(
        updateElementTool.mcpDefinition.inputSchema.safeParse({ updates: { label: 'New' } }).success
      ).toBe(false);
    });

    it('rejects missing updates', () => {
      expect(updateElementTool.mcpDefinition.inputSchema.safeParse({ elementId: 'el-1' }).success).toBe(false);
    });
  });

  describe('outputSchema', () => {
    it('validates updated element', () => {
      expect(updateElementTool.mcpDefinition.outputSchema.safeParse({ data: validElement }).success).toBe(true);
    });
  });
});

describe('deleteElementTool', () => {
  it('has correct name and adapterName', () => {
    expect(deleteElementTool.name).toBe('delete_element');
    expect(deleteElementTool.adapterName).toBe('deleteElement');
  });

  it('allows only build mode (write)', () => {
    expect(deleteElementTool.definition.allowedModes).toEqual(['build']);
  });

  describe('inputSchema', () => {
    it('accepts elementId', () => {
      expect(deleteElementTool.mcpDefinition.inputSchema.safeParse({ elementId: 'el-1' }).success).toBe(true);
    });

    it('rejects missing elementId', () => {
      expect(deleteElementTool.mcpDefinition.inputSchema.safeParse({}).success).toBe(false);
    });
  });

  describe('outputSchema', () => {
    it('validates data: true', () => {
      expect(deleteElementTool.mcpDefinition.outputSchema.safeParse({ data: true }).success).toBe(true);
    });

    it('rejects data: false', () => {
      expect(deleteElementTool.mcpDefinition.outputSchema.safeParse({ data: false }).success).toBe(false);
    });
  });
});

describe('getElementTool', () => {
  it('has correct name and adapterName', () => {
    expect(getElementTool.name).toBe('get_element');
    expect(getElementTool.adapterName).toBe('getElement');
  });

  it('allows plan and build modes (read)', () => {
    expect(getElementTool.definition.allowedModes).toEqual(['plan', 'build']);
  });

  describe('inputSchema', () => {
    it('accepts elementId', () => {
      expect(getElementTool.mcpDefinition.inputSchema.safeParse({ elementId: 'el-1' }).success).toBe(true);
    });

    it('rejects missing elementId', () => {
      expect(getElementTool.mcpDefinition.inputSchema.safeParse({}).success).toBe(false);
    });
  });

  describe('outputSchema', () => {
    it('validates a found element', () => {
      expect(getElementTool.mcpDefinition.outputSchema.safeParse({ data: validElement }).success).toBe(true);
    });

    it('validates null (not found)', () => {
      expect(getElementTool.mcpDefinition.outputSchema.safeParse({ data: null }).success).toBe(true);
    });
  });
});

describe('listElementsTool', () => {
  it('has correct name and adapterName', () => {
    expect(listElementsTool.name).toBe('list_elements');
    expect(listElementsTool.adapterName).toBe('listElements');
  });

  it('allows plan and build modes (read)', () => {
    expect(listElementsTool.definition.allowedModes).toEqual(['plan', 'build']);
  });

  describe('inputSchema', () => {
    it('accepts empty object', () => {
      expect(listElementsTool.mcpDefinition.inputSchema.safeParse({}).success).toBe(true);
    });
  });

  describe('outputSchema', () => {
    it('validates an array of elements', () => {
      expect(listElementsTool.mcpDefinition.outputSchema.safeParse({ data: [validElement] }).success).toBe(true);
    });

    it('validates an empty array', () => {
      expect(listElementsTool.mcpDefinition.outputSchema.safeParse({ data: [] }).success).toBe(true);
    });
  });
});

describe('moveElementTool', () => {
  it('has correct name and adapterName', () => {
    expect(moveElementTool.name).toBe('move_element');
    expect(moveElementTool.adapterName).toBe('moveElement');
  });

  it('allows only build mode (write)', () => {
    expect(moveElementTool.definition.allowedModes).toEqual(['build']);
  });

  describe('inputSchema', () => {
    it('accepts required fields', () => {
      expect(
        moveElementTool.mcpDefinition.inputSchema.safeParse({ elementId: 'el-1', toParentId: 'page-1' }).success
      ).toBe(true);
    });

    it('accepts with optional dropPosition', () => {
      expect(
        moveElementTool.mcpDefinition.inputSchema.safeParse({
          elementId: 'el-1',
          toParentId: 'page-1',
          dropPosition: 'inside'
        }).success
      ).toBe(true);
    });

    it('rejects invalid dropPosition', () => {
      expect(
        moveElementTool.mcpDefinition.inputSchema.safeParse({
          elementId: 'el-1',
          toParentId: 'page-1',
          dropPosition: 'center'
        }).success
      ).toBe(false);
    });

    it('rejects missing toParentId', () => {
      expect(moveElementTool.mcpDefinition.inputSchema.safeParse({ elementId: 'el-1' }).success).toBe(false);
    });
  });

  describe('outputSchema', () => {
    it('validates data: true', () => {
      expect(moveElementTool.mcpDefinition.outputSchema.safeParse({ data: true }).success).toBe(true);
    });
  });
});

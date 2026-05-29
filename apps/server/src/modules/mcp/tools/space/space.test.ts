import { describe, it, expect } from 'vitest';

import listSpacesTool from './listSpaces';
import publishSpaceTool from './publishSpace';

describe('listSpacesTool', () => {
  it('has correct name and adapterName', () => {
    expect(listSpacesTool.name).toBe('list_spaces');
    expect(listSpacesTool.adapterName).toBe('listSpaces');
  });

  it('allows plan and build modes (read)', () => {
    expect(listSpacesTool.definition.allowedModes).toEqual(['plan', 'build']);
  });

  describe('inputSchema', () => {
    it('accepts empty object', () => {
      expect(listSpacesTool.mcpDefinition.inputSchema.safeParse({}).success).toBe(true);
    });
  });

  describe('outputSchema', () => {
    it('validates a list of spaces', () => {
      const result = listSpacesTool.mcpDefinition.outputSchema.safeParse({
        data: [{ id: 'sp-1', name: 'My Space', permanentUrl: 'https://example.com', verified: true }]
      });

      expect(result.success).toBe(true);
    });

    it('validates an empty list', () => {
      const result = listSpacesTool.mcpDefinition.outputSchema.safeParse({ data: [] });

      expect(result.success).toBe(true);
    });

    it('rejects missing data field', () => {
      expect(listSpacesTool.mcpDefinition.outputSchema.safeParse({}).success).toBe(false);
    });
  });
});

describe('publishSpaceTool', () => {
  it('has correct name and adapterName', () => {
    expect(publishSpaceTool.name).toBe('publish_space');
    expect(publishSpaceTool.adapterName).toBe('publishSpace');
  });

  it('allows only build mode (write)', () => {
    expect(publishSpaceTool.definition.allowedModes).toEqual(['build']);
  });

  describe('inputSchema', () => {
    it('accepts empty object', () => {
      expect(publishSpaceTool.mcpDefinition.inputSchema.safeParse({}).success).toBe(true);
    });
  });

  describe('outputSchema', () => {
    it('validates a revision number', () => {
      const result = publishSpaceTool.mcpDefinition.outputSchema.safeParse({ data: { revision: 42 } });

      expect(result.success).toBe(true);
    });

    it('rejects missing revision', () => {
      expect(publishSpaceTool.mcpDefinition.outputSchema.safeParse({ data: {} }).success).toBe(false);
    });
  });
});

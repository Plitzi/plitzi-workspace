import { describe, it, expect } from 'vitest';

import addResourceTool from './addResource';
import getResourceTool from './getResource';
import getResourcesTool from './getResources';
import moveResourceTool from './moveResource';
import removeResourceTool from './removeResource';

const validResource = {
  id: 'images/hero.jpg',
  name: 'hero.jpg',
  path: 'https://cdn.example.com/images/hero.jpg',
  type: 'image',
  size: 204800,
  cdnIdentifier: 'cdn-1',
  created_at: 1700000000,
  updated_at: 1700000000
};

describe('getResourcesTool', () => {
  it('has correct name and adapterName', () => {
    expect(getResourcesTool.name).toBe('get_resources');
    expect(getResourcesTool.adapterName).toBe('getResources');
  });

  it('allows plan and build modes (read)', () => {
    expect(getResourcesTool.definition.allowedModes).toEqual(['plan', 'build']);
  });

  describe('inputSchema', () => {
    it('accepts empty object', () => {
      expect(getResourcesTool.mcpDefinition.inputSchema?.safeParse({}).success).toBe(true);
    });
  });

  describe('outputSchema', () => {
    it('validates a list of resources', () => {
      expect(getResourcesTool.mcpDefinition.outputSchema?.safeParse({ resources: [validResource] }).success).toBe(true);
    });

    it('validates empty resources list', () => {
      expect(getResourcesTool.mcpDefinition.outputSchema?.safeParse({ resources: [] }).success).toBe(true);
    });
  });
});

describe('getResourceTool', () => {
  it('has correct name and adapterName', () => {
    expect(getResourceTool.name).toBe('get_resource');
    expect(getResourceTool.adapterName).toBe('getResource');
  });

  it('allows plan and build modes (read)', () => {
    expect(getResourceTool.definition.allowedModes).toEqual(['plan', 'build']);
  });

  describe('inputSchema', () => {
    it('accepts identifier and cdnIdentifier', () => {
      expect(
        getResourceTool.mcpDefinition.inputSchema?.safeParse({ identifier: 'images/hero.jpg', cdnIdentifier: 'cdn-1' })
          .success
      ).toBe(true);
    });

    it('rejects missing cdnIdentifier', () => {
      expect(getResourceTool.mcpDefinition.inputSchema?.safeParse({ identifier: 'images/hero.jpg' }).success).toBe(
        false
      );
    });
  });

  describe('outputSchema', () => {
    it('validates a found resource', () => {
      expect(getResourceTool.mcpDefinition.outputSchema?.safeParse(validResource).success).toBe(true);
    });

    it('validates null (not found)', () => {
      expect(getResourceTool.mcpDefinition.outputSchema?.safeParse(null).success).toBe(true);
    });
  });
});

describe('addResourceTool', () => {
  it('has correct name and adapterName', () => {
    expect(addResourceTool.name).toBe('add_resource');
    expect(addResourceTool.adapterName).toBe('addResource');
  });

  it('allows only build mode (write)', () => {
    expect(addResourceTool.definition.allowedModes).toEqual(['build']);
  });

  describe('inputSchema', () => {
    it('accepts required fields', () => {
      expect(
        addResourceTool.mcpDefinition.inputSchema?.safeParse({
          url: 'https://example.com/image.jpg',
          cdnIdentifier: 'cdn-1'
        }).success
      ).toBe(true);
    });

    it('accepts all optional fields', () => {
      expect(
        addResourceTool.mcpDefinition.inputSchema?.safeParse({
          url: 'https://example.com/image.jpg',
          cdnIdentifier: 'cdn-1',
          filename: 'custom-name.jpg',
          type: 'image',
          prefix: 'uploads/',
          compression: 'gzip'
        }).success
      ).toBe(true);
    });

    it('rejects missing cdnIdentifier', () => {
      expect(
        addResourceTool.mcpDefinition.inputSchema?.safeParse({ url: 'https://example.com/image.jpg' }).success
      ).toBe(false);
    });
  });

  describe('outputSchema', () => {
    it('validates uploaded resource', () => {
      expect(addResourceTool.mcpDefinition.outputSchema?.safeParse(validResource).success).toBe(true);
    });
  });
});

describe('moveResourceTool', () => {
  it('has correct name and adapterName', () => {
    expect(moveResourceTool.name).toBe('move_resource');
    expect(moveResourceTool.adapterName).toBe('moveResource');
  });

  it('allows only build mode (write)', () => {
    expect(moveResourceTool.definition.allowedModes).toEqual(['build']);
  });

  describe('inputSchema', () => {
    it('accepts required fields', () => {
      expect(
        moveResourceTool.mcpDefinition.inputSchema?.safeParse({
          identifier: 'images/hero.jpg',
          cdnIdentifier: 'cdn-1',
          prefix: 'archive/'
        }).success
      ).toBe(true);
    });

    it('rejects missing prefix', () => {
      expect(
        moveResourceTool.mcpDefinition.inputSchema?.safeParse({
          identifier: 'images/hero.jpg',
          cdnIdentifier: 'cdn-1'
        }).success
      ).toBe(false);
    });
  });

  describe('outputSchema', () => {
    it('validates moved resource', () => {
      expect(moveResourceTool.mcpDefinition.outputSchema?.safeParse(validResource).success).toBe(true);
    });
  });
});

describe('removeResourceTool', () => {
  it('has correct name and adapterName', () => {
    expect(removeResourceTool.name).toBe('remove_resource');
    expect(removeResourceTool.adapterName).toBe('removeResource');
  });

  it('allows only build mode (write)', () => {
    expect(removeResourceTool.definition.allowedModes).toEqual(['build']);
  });

  describe('inputSchema', () => {
    it('accepts identifier and cdnIdentifier', () => {
      expect(
        removeResourceTool.mcpDefinition.inputSchema?.safeParse({
          identifier: 'images/hero.jpg',
          cdnIdentifier: 'cdn-1'
        }).success
      ).toBe(true);
    });

    it('rejects missing identifier', () => {
      expect(removeResourceTool.mcpDefinition.inputSchema?.safeParse({ cdnIdentifier: 'cdn-1' }).success).toBe(false);
    });
  });

  describe('outputSchema', () => {
    it('validates deleted resource confirmation', () => {
      expect(removeResourceTool.mcpDefinition.outputSchema?.safeParse({ id: 'images/hero.jpg' }).success).toBe(true);
    });

    it('rejects missing id', () => {
      expect(removeResourceTool.mcpDefinition.outputSchema?.safeParse({}).success).toBe(false);
    });
  });
});

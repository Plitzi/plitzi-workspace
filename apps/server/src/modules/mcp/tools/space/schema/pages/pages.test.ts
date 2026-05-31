import { describe, it, expect } from 'vitest';

import createPageTool from './createPage';
import deletePageTool from './deletePage';

const validPageElement = {
  id: 'page-1',
  attributes: {},
  definition: {
    rootId: 'page-1',
    label: 'Home',
    type: 'page',
    styleSelectors: {}
  }
};

describe('createPageTool', () => {
  it('has correct name and adapterName', () => {
    expect(createPageTool.name).toBe('create_page');
    expect(createPageTool.adapterName).toBe('createPage');
  });

  it('allows only build mode (write)', () => {
    expect(createPageTool.definition.allowedModes).toEqual(['build']);
  });

  describe('inputSchema', () => {
    it('accepts a page name', () => {
      expect(createPageTool.mcpDefinition.inputSchema?.safeParse({ name: 'About' }).success).toBe(true);
    });

    it('rejects missing name', () => {
      expect(createPageTool.mcpDefinition.inputSchema?.safeParse({}).success).toBe(false);
    });
  });

  describe('outputSchema', () => {
    it('validates a created page element', () => {
      expect(createPageTool.mcpDefinition.outputSchema?.safeParse(validPageElement).success).toBe(true);
    });

    it('rejects missing definition', () => {
      expect(createPageTool.mcpDefinition.outputSchema?.safeParse({ id: 'page-1', attributes: {} }).success).toBe(
        false
      );
    });
  });
});

describe('deletePageTool', () => {
  it('has correct name and adapterName', () => {
    expect(deletePageTool.name).toBe('delete_page');
    expect(deletePageTool.adapterName).toBe('deletePage');
  });

  it('allows only build mode (write)', () => {
    expect(deletePageTool.definition.allowedModes).toEqual(['build']);
  });

  describe('inputSchema', () => {
    it('accepts pageId', () => {
      expect(deletePageTool.mcpDefinition.inputSchema?.safeParse({ pageId: 'page-1' }).success).toBe(true);
    });

    it('rejects missing pageId', () => {
      expect(deletePageTool.mcpDefinition.inputSchema?.safeParse({}).success).toBe(false);
    });
  });

  describe('outputSchema', () => {
    it('validates data: true', () => {
      expect(deletePageTool.mcpDefinition.outputSchema?.safeParse(true).success).toBe(true);
    });
  });
});

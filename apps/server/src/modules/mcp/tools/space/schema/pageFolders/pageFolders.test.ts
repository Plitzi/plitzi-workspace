import { describe, it, expect } from 'vitest';

import createPageFolderTool from './createPageFolder';
import deletePageFolderTool from './deletePageFolder';
import updatePageFolderTool from './updatePageFolder';

const validFolder = { id: 'folder-1', name: 'Blog', slug: 'blog' };

describe('createPageFolderTool', () => {
  it('has correct name and adapterName', () => {
    expect(createPageFolderTool.name).toBe('create_page_folder');
    expect(createPageFolderTool.adapterName).toBe('createPageFolder');
  });

  it('allows only build mode (write)', () => {
    expect(createPageFolderTool.definition.allowedModes).toEqual(['build']);
  });

  describe('inputSchema', () => {
    it('accepts a folder name', () => {
      expect(createPageFolderTool.mcpDefinition.inputSchema?.safeParse({ name: 'Blog' }).success).toBe(true);
    });

    it('rejects missing name', () => {
      expect(createPageFolderTool.mcpDefinition.inputSchema?.safeParse({}).success).toBe(false);
    });
  });

  describe('outputSchema', () => {
    it('validates created folder', () => {
      expect(createPageFolderTool.mcpDefinition.outputSchema?.safeParse(validFolder).success).toBe(true);
    });
  });
});

describe('updatePageFolderTool', () => {
  it('has correct name and adapterName', () => {
    expect(updatePageFolderTool.name).toBe('update_page_folder');
    expect(updatePageFolderTool.adapterName).toBe('updatePageFolder');
  });

  it('allows only build mode (write)', () => {
    expect(updatePageFolderTool.definition.allowedModes).toEqual(['build']);
  });

  describe('inputSchema', () => {
    it('accepts id with partial updates', () => {
      expect(
        updatePageFolderTool.mcpDefinition.inputSchema?.safeParse({ id: 'folder-1', updates: { name: 'News' } }).success
      ).toBe(true);
    });

    it('rejects missing id', () => {
      expect(updatePageFolderTool.mcpDefinition.inputSchema?.safeParse({ updates: { name: 'News' } }).success).toBe(
        false
      );
    });

    it('rejects missing updates', () => {
      expect(updatePageFolderTool.mcpDefinition.inputSchema?.safeParse({ id: 'folder-1' }).success).toBe(false);
    });
  });

  describe('outputSchema', () => {
    it('validates updated folder', () => {
      expect(updatePageFolderTool.mcpDefinition.outputSchema?.safeParse(validFolder).success).toBe(true);
    });
  });
});

describe('deletePageFolderTool', () => {
  it('has correct name and adapterName', () => {
    expect(deletePageFolderTool.name).toBe('delete_page_folder');
    expect(deletePageFolderTool.adapterName).toBe('deletePageFolder');
  });

  it('allows only build mode (write)', () => {
    expect(deletePageFolderTool.definition.allowedModes).toEqual(['build']);
  });

  describe('inputSchema', () => {
    it('accepts folder id', () => {
      expect(deletePageFolderTool.mcpDefinition.inputSchema?.safeParse({ id: 'folder-1' }).success).toBe(true);
    });

    it('rejects missing id', () => {
      expect(deletePageFolderTool.mcpDefinition.inputSchema?.safeParse({}).success).toBe(false);
    });
  });

  describe('outputSchema', () => {
    it('validates data: true', () => {
      expect(deletePageFolderTool.mcpDefinition.outputSchema?.safeParse(true).success).toBe(true);
    });
  });
});

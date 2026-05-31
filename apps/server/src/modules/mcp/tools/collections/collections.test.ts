import { describe, it, expect } from 'vitest';

import createCollectionTool from './createCollection';
import createCollectionRecordTool from './createCollectionRecord';
import deleteCollectionTool from './deleteCollection';
import deleteCollectionRecordTool from './deleteCollectionRecord';
import getCollectionTool from './getCollection';
import getCollectionRecordTool from './getCollectionRecord';
import getCollectionRecordsTool from './getCollectionRecords';
import getCollectionsTool from './getCollections';
import updateCollectionTool from './updateCollection';
import updateCollectionRecordTool from './updateCollectionRecord';

const validCollection = { id: 'col-1', name: 'Product', namePlural: 'Products', fields: { title: { type: 'text' } } };
const validRecord = {
  id: 'rec-1',
  collectionId: 'col-1',
  values: { title: 'My Product' },
  status: 'draft' as const
};

describe('getCollectionsTool', () => {
  it('has correct name and adapterName', () => {
    expect(getCollectionsTool.name).toBe('get_collections');
    expect(getCollectionsTool.adapterName).toBe('getCollections');
  });

  it('allows plan and build modes (read)', () => {
    expect(getCollectionsTool.definition.allowedModes).toEqual(['plan', 'build']);
  });

  describe('inputSchema', () => {
    it('accepts empty object', () => {
      expect(getCollectionsTool.mcpDefinition.inputSchema?.safeParse({}).success).toBe(true);
    });
  });

  describe('outputSchema', () => {
    it('validates a list of collections', () => {
      expect(getCollectionsTool.mcpDefinition.outputSchema?.safeParse([validCollection]).success).toBe(true);
    });

    it('validates empty list', () => {
      expect(getCollectionsTool.mcpDefinition.outputSchema?.safeParse([]).success).toBe(true);
    });
  });
});

describe('getCollectionTool', () => {
  it('has correct name and adapterName', () => {
    expect(getCollectionTool.name).toBe('get_collection');
    expect(getCollectionTool.adapterName).toBe('getCollection');
  });

  it('allows plan and build modes (read)', () => {
    expect(getCollectionTool.definition.allowedModes).toEqual(['plan', 'build']);
  });

  describe('inputSchema', () => {
    it('accepts collectionId', () => {
      expect(getCollectionTool.mcpDefinition.inputSchema?.safeParse({ collectionId: 'col-1' }).success).toBe(true);
    });

    it('rejects missing collectionId', () => {
      expect(getCollectionTool.mcpDefinition.inputSchema?.safeParse({}).success).toBe(false);
    });
  });

  describe('outputSchema', () => {
    it('validates a collection', () => {
      expect(getCollectionTool.mcpDefinition.outputSchema?.safeParse(validCollection).success).toBe(true);
    });

    it('validates null (not found)', () => {
      expect(getCollectionTool.mcpDefinition.outputSchema?.safeParse(null).success).toBe(true);
    });
  });
});

describe('createCollectionTool', () => {
  it('has correct name and adapterName', () => {
    expect(createCollectionTool.name).toBe('create_collection');
    expect(createCollectionTool.adapterName).toBe('createCollection');
  });

  it('allows only build mode (write)', () => {
    expect(createCollectionTool.definition.allowedModes).toEqual(['build']);
  });

  describe('inputSchema', () => {
    it('accepts required fields', () => {
      expect(
        createCollectionTool.mcpDefinition.inputSchema?.safeParse({
          name: 'Product',
          namePlural: 'Products',
          fields: { title: { type: 'text' } }
        }).success
      ).toBe(true);
    });

    it('accepts all optional fields', () => {
      expect(
        createCollectionTool.mcpDefinition.inputSchema?.safeParse({
          name: 'Product',
          namePlural: 'Products',
          description: 'Product catalog',
          privacy: 'public',
          fields: { title: { type: 'text' } }
        }).success
      ).toBe(true);
    });

    it('rejects invalid privacy', () => {
      expect(
        createCollectionTool.mcpDefinition.inputSchema?.safeParse({
          name: 'P',
          namePlural: 'Ps',
          fields: {},
          privacy: 'restricted'
        }).success
      ).toBe(false);
    });

    it('rejects missing name', () => {
      expect(
        createCollectionTool.mcpDefinition.inputSchema?.safeParse({ namePlural: 'Products', fields: {} }).success
      ).toBe(false);
    });
  });

  describe('outputSchema', () => {
    it('validates created collection', () => {
      expect(createCollectionTool.mcpDefinition.outputSchema?.safeParse(validCollection).success).toBe(true);
    });
  });
});

describe('updateCollectionTool', () => {
  it('has correct name and adapterName', () => {
    expect(updateCollectionTool.name).toBe('update_collection');
    expect(updateCollectionTool.adapterName).toBe('updateCollection');
  });

  it('allows only build mode (write)', () => {
    expect(updateCollectionTool.definition.allowedModes).toEqual(['build']);
  });

  describe('inputSchema', () => {
    it('accepts collectionId with partial updates', () => {
      expect(
        updateCollectionTool.mcpDefinition.inputSchema?.safeParse({
          collectionId: 'col-1',
          updates: { name: 'Item' }
        }).success
      ).toBe(true);
    });

    it('rejects missing collectionId', () => {
      expect(updateCollectionTool.mcpDefinition.inputSchema?.safeParse({ updates: { name: 'Item' } }).success).toBe(
        false
      );
    });
  });

  describe('outputSchema', () => {
    it('validates updated collection', () => {
      expect(updateCollectionTool.mcpDefinition.outputSchema?.safeParse(validCollection).success).toBe(true);
    });
  });
});

describe('deleteCollectionTool', () => {
  it('has correct name and adapterName', () => {
    expect(deleteCollectionTool.name).toBe('delete_collection');
    expect(deleteCollectionTool.adapterName).toBe('deleteCollection');
  });

  it('allows only build mode (write)', () => {
    expect(deleteCollectionTool.definition.allowedModes).toEqual(['build']);
  });

  describe('inputSchema', () => {
    it('accepts collectionId', () => {
      expect(deleteCollectionTool.mcpDefinition.inputSchema?.safeParse({ collectionId: 'col-1' }).success).toBe(true);
    });

    it('rejects missing collectionId', () => {
      expect(deleteCollectionTool.mcpDefinition.inputSchema?.safeParse({}).success).toBe(false);
    });
  });

  describe('outputSchema', () => {
    it('validates data: true', () => {
      expect(deleteCollectionTool.mcpDefinition.outputSchema?.safeParse(true).success).toBe(true);
    });
  });
});

describe('getCollectionRecordsTool', () => {
  it('has correct name and adapterName', () => {
    expect(getCollectionRecordsTool.name).toBe('get_collection_records');
    expect(getCollectionRecordsTool.adapterName).toBe('getCollectionRecords');
  });

  it('allows plan and build modes (read)', () => {
    expect(getCollectionRecordsTool.definition.allowedModes).toEqual(['plan', 'build']);
  });

  describe('inputSchema', () => {
    it('accepts collectionId', () => {
      expect(getCollectionRecordsTool.mcpDefinition.inputSchema?.safeParse({ collectionId: 'col-1' }).success).toBe(
        true
      );
    });

    it('rejects missing collectionId', () => {
      expect(getCollectionRecordsTool.mcpDefinition.inputSchema?.safeParse({}).success).toBe(false);
    });
  });

  describe('outputSchema', () => {
    it('validates a list of records', () => {
      expect(getCollectionRecordsTool.mcpDefinition.outputSchema?.safeParse([validRecord]).success).toBe(true);
    });
  });
});

describe('getCollectionRecordTool', () => {
  it('has correct name and adapterName', () => {
    expect(getCollectionRecordTool.name).toBe('get_collection_record');
    expect(getCollectionRecordTool.adapterName).toBe('getCollectionRecord');
  });

  it('allows plan and build modes (read)', () => {
    expect(getCollectionRecordTool.definition.allowedModes).toEqual(['plan', 'build']);
  });

  describe('inputSchema', () => {
    it('accepts recordId', () => {
      expect(getCollectionRecordTool.mcpDefinition.inputSchema?.safeParse({ recordId: 'rec-1' }).success).toBe(true);
    });

    it('rejects missing recordId', () => {
      expect(getCollectionRecordTool.mcpDefinition.inputSchema?.safeParse({}).success).toBe(false);
    });
  });

  describe('outputSchema', () => {
    it('validates a found record', () => {
      expect(getCollectionRecordTool.mcpDefinition.outputSchema?.safeParse(validRecord).success).toBe(true);
    });

    it('validates null (not found)', () => {
      expect(getCollectionRecordTool.mcpDefinition.outputSchema?.safeParse(null).success).toBe(true);
    });
  });
});

describe('createCollectionRecordTool', () => {
  it('has correct name and adapterName', () => {
    expect(createCollectionRecordTool.name).toBe('create_collection_record');
    expect(createCollectionRecordTool.adapterName).toBe('createCollectionRecord');
  });

  it('allows only build mode (write)', () => {
    expect(createCollectionRecordTool.definition.allowedModes).toEqual(['build']);
  });

  describe('inputSchema', () => {
    it('accepts collectionId and values', () => {
      expect(
        createCollectionRecordTool.mcpDefinition.inputSchema?.safeParse({
          collectionId: 'col-1',
          values: { title: 'My Product', price: 99 }
        }).success
      ).toBe(true);
    });

    it('accepts optional status', () => {
      expect(
        createCollectionRecordTool.mcpDefinition.inputSchema?.safeParse({
          collectionId: 'col-1',
          values: { title: 'x' },
          status: 'published'
        }).success
      ).toBe(true);
    });

    it('rejects invalid status', () => {
      expect(
        createCollectionRecordTool.mcpDefinition.inputSchema?.safeParse({
          collectionId: 'col-1',
          values: { title: 'x' },
          status: 'pending'
        }).success
      ).toBe(false);
    });
  });

  describe('outputSchema', () => {
    it('validates created record', () => {
      expect(createCollectionRecordTool.mcpDefinition.outputSchema?.safeParse(validRecord).success).toBe(true);
    });
  });
});

describe('updateCollectionRecordTool', () => {
  it('has correct name and adapterName', () => {
    expect(updateCollectionRecordTool.name).toBe('update_collection_record');
    expect(updateCollectionRecordTool.adapterName).toBe('updateCollectionRecord');
  });

  it('allows only build mode (write)', () => {
    expect(updateCollectionRecordTool.definition.allowedModes).toEqual(['build']);
  });

  describe('inputSchema', () => {
    it('accepts recordId with optional fields', () => {
      expect(
        updateCollectionRecordTool.mcpDefinition.inputSchema?.safeParse({
          recordId: 'rec-1',
          values: { title: 'Updated' },
          status: 'published'
        }).success
      ).toBe(true);
    });

    it('accepts recordId only', () => {
      expect(updateCollectionRecordTool.mcpDefinition.inputSchema?.safeParse({ recordId: 'rec-1' }).success).toBe(true);
    });

    it('rejects invalid status', () => {
      expect(
        updateCollectionRecordTool.mcpDefinition.inputSchema?.safeParse({
          recordId: 'rec-1',
          status: 'pending'
        }).success
      ).toBe(false);
    });
  });

  describe('outputSchema', () => {
    it('validates updated record', () => {
      expect(updateCollectionRecordTool.mcpDefinition.outputSchema?.safeParse(validRecord).success).toBe(true);
    });
  });
});

describe('deleteCollectionRecordTool', () => {
  it('has correct name and adapterName', () => {
    expect(deleteCollectionRecordTool.name).toBe('delete_collection_record');
    expect(deleteCollectionRecordTool.adapterName).toBe('deleteCollectionRecord');
  });

  it('allows only build mode (write)', () => {
    expect(deleteCollectionRecordTool.definition.allowedModes).toEqual(['build']);
  });

  describe('inputSchema', () => {
    it('accepts recordId', () => {
      expect(deleteCollectionRecordTool.mcpDefinition.inputSchema?.safeParse({ recordId: 'rec-1' }).success).toBe(true);
    });

    it('rejects missing recordId', () => {
      expect(deleteCollectionRecordTool.mcpDefinition.inputSchema?.safeParse({}).success).toBe(false);
    });
  });

  describe('outputSchema', () => {
    it('validates data: true', () => {
      expect(deleteCollectionRecordTool.mcpDefinition.outputSchema?.safeParse(true).success).toBe(true);
    });
  });
});

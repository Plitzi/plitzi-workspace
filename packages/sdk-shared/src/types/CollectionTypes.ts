export type PageInfo = {
  hasPrevPage: boolean;
  hasNextPage: boolean;
  prevCursor: string;
  nextCursor: string;
  from: number;
  to: number;
  total: number;
};

export type CollectionField = unknown;

export type Collection = {
  id: string;
  name: string;
  mamePlural: string;
  description: string;
  privacy: 'public' | 'private';
  fields: CollectionField[];
};

export type CollectionRecord = {
  id: string;
  values: Record<string, string | number | boolean>;
  createdAt: number;
  updatedAt: number;
};

// export type CollectionRecords = CollectionRecord[];

export type CollectionContextValue = {
  collections: Collection[];
  fetchCollections?: (
    filter: string,
    cursor?: string,
    limit?: number,
    append?: CollectionRecord[],
    store?: boolean
  ) => unknown;
  fetchCollection?: (id: string, recordsFilter: string, store?: boolean) => unknown;
  addCollection?: unknown;
  updateCollection?: unknown;
  removeCollection?: unknown;
  fetchRecords?: (
    collectionId: string,
    filter: string,
    cursor?: string,
    limit?: number,
    append?: CollectionRecord[],
    store?: boolean
  ) => unknown;
  fetchRecord?: unknown;
  addRecord?: unknown;
  updateRecord?: unknown;
  removeRecord?: unknown;
};

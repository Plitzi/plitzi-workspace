export type PageInfo = {
  hasPrevPage: boolean;
  hasNextPage: boolean;
  prevCursor: string;
  nextCursor: string;
  from: number;
  to: number;
  total: number;
};

export type CollectionField = {
  id: string;
  name: string;
  machineName: string;
  type: 'text' | 'number' | 'boolean' | 'date';
  params: Record<string, { primary: boolean; required: boolean }>;
};

export type CollectionRecord = {
  id: string;
  values: Record<string, string | number | boolean>;
  createdAt: number;
  updatedAt: number;
};

export type Collection = {
  id: string;
  name: string;
  namePlural: string;
  description: string;
  privacy: 'public' | 'private';
  fields: Record<string, CollectionField>;
  records?: CollectionRecord[];
};

export type CollectionContextValue = {
  collections: Record<string, Collection>;
  fetchCollections?: (
    filter: string,
    cursor?: string,
    limit?: number,
    append?: CollectionRecord[],
    store?: boolean
  ) => unknown;
  fetchCollection?: (id: string, recordsFilter: string, store?: boolean) => unknown;
  addCollection?: (
    name: string,
    namePlural: string,
    description: string,
    privacy: 'public' | 'private',
    fields: Record<string, CollectionField>
  ) => Promise<Collection>;
  updateCollection?: (
    id: string,
    name: string,
    namePlural: string,
    description: string,
    privacy: 'public' | 'private',
    fields: Record<string, CollectionField>
  ) => Promise<Collection>;
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

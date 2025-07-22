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
  status: 'draft' | 'published' | 'archived';
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
  records: CollectionRecord[];
};

export type CollectionContextValue = {
  collections: Record<string, Collection>;
  fetchCollections?: (
    filter: string,
    cursor?: string,
    limit?: number,
    append?: CollectionRecord[],
    store?: boolean
  ) => Promise<Collection[]>;
  fetchCollection?: (
    id: string,
    recordsFilter: string,
    store?: boolean
  ) => Promise<Omit<Collection, 'records'> & { records: { pageInfo: PageInfo; edges: CollectionRecord[] } }>;
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
  removeCollection?: (id: string) => Promise<Collection>;
  fetchRecords?: (
    collectionId: string,
    filter: string,
    cursor?: string,
    limit?: number,
    append?: CollectionRecord[],
    store?: boolean
  ) => Promise<{ pageInfo: PageInfo; edges: CollectionRecord[] }>;
  fetchRecord?: (collectionId: string, id: string, store?: boolean) => Promise<CollectionRecord | undefined>;
  addRecord?: (
    collectionId: string,
    status: string,
    values: CollectionRecord['values'],
    updateStore?: boolean
  ) => Promise<CollectionRecord>;
  updateRecord?: (
    collectionId: string,
    recordId: string,
    status: string,
    values: CollectionRecord['values'],
    updateStore?: boolean
  ) => Promise<CollectionRecord>;
  removeRecord?: (collectionId: string, recordId: string, updateStore?: boolean) => Promise<CollectionRecord>;
};

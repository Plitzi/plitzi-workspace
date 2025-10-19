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
  type:
    | 'text'
    | 'richText'
    | 'image'
    | 'multiImage'
    | 'video'
    | 'link'
    | 'email'
    | 'phone'
    | 'number'
    | 'date'
    | 'switch'
    | 'color'
    | 'option'
    | 'file';
  params: { primary: boolean; required: boolean };
};

export type CollectionRecord = {
  id: string;
  values: Record<string, string | number | boolean>;
  status: 'draft' | 'published' | 'archived';
  createdAt: number;
  updatedAt: number;
  publishedAt?: number;
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

export type BuilderCollectionContextValue = {
  collections: Record<string, Collection>;
  fetchCollections: (
    filter: string,
    cursor?: string,
    limit?: number,
    append?: Collection[],
    store?: boolean
  ) => Promise<{ edges: CollectionRaw[]; pageInfo: PageInfo } | undefined>;
  fetchCollection: (id: string, recordsFilter: string, store?: boolean) => Promise<CollectionRaw | undefined>;
  addCollection: (
    name: string,
    namePlural: string,
    description: string,
    privacy: Collection['privacy'],
    fields: Collection['fields']
  ) => Promise<Collection | undefined>;
  updateCollection: (
    id: string,
    name: string,
    namePlural: string,
    description: string,
    privacy: Collection['privacy'],
    fields: Collection['fields']
  ) => Promise<Collection | undefined>;
  removeCollection: (id: string) => Promise<boolean>;
  fetchRecords: (
    collectionId: string,
    filter?: string | object,
    cursor?: string,
    limit?: number,
    append?: CollectionRecord[],
    store?: boolean
  ) => Promise<{ pageInfo: PageInfo; edges: CollectionRecord[] } | undefined>;
  fetchRecord: (collectionId: string, id: string, store?: boolean) => Promise<CollectionRecord | undefined>;
  addRecord: (
    collectionId: string,
    status: CollectionRecord['status'],
    values: CollectionRecord['values'],
    updateStore?: boolean
  ) => Promise<CollectionRecord | undefined>;
  updateRecord: (
    collectionId: string,
    recordId: string,
    status: CollectionRecord['status'],
    values: CollectionRecord['values'],
    updateStore?: boolean
  ) => Promise<CollectionRecord | undefined>;
  removeRecord: (collectionId: string, recordId: string, updateStore?: boolean) => Promise<boolean>;
};

export type SdkCollectionContextValue = {
  collections: Record<string, Collection>;
  fetchCollections: (
    filter: string,
    cursor?: string,
    limit?: number
  ) => Promise<{ edges: CollectionRaw[]; pageInfo: PageInfo } | undefined>;
  fetchCollection: (id: string, recordsFilter: string) => Promise<CollectionRaw | undefined>;
  fetchRecords: (
    collectionId: string,
    filter?: string | object,
    cursor?: string,
    limit?: number
  ) => Promise<{ pageInfo: PageInfo; edges: CollectionRecord[] } | undefined>;
  fetchRecord: (collectionId: string, id: string) => Promise<CollectionRecord | undefined>;
  addRecord: (
    collectionId: string,
    status: CollectionRecord['status'],
    values: CollectionRecord['values'],
    updateStore?: boolean
  ) => Promise<CollectionRecord | undefined>;
  updateRecord: (
    collectionId: string,
    recordId: string,
    status: CollectionRecord['status'],
    values: CollectionRecord['values'],
    updateStore?: boolean
  ) => Promise<CollectionRecord | undefined>;
  removeRecord: (collectionId: string, recordId: string, updateStore?: boolean) => Promise<boolean>;
};

export type CollectionContextValue<T extends 'builder' | 'sdk' = 'sdk'> = T extends 'builder'
  ? BuilderCollectionContextValue
  : SdkCollectionContextValue;

// Raws

export type CollectionRaw = {
  id: string;
  name: string;
  namePlural: string;
  description: string;
  privacy: 'public' | 'private';
  fields: Record<string, CollectionField>;
  records: { pageInfo: PageInfo; edges: CollectionRecord[] };
};

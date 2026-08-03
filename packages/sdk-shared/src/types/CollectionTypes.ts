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
  /** Provider-shaped values. Not flat: external CMSs carry components, relations and localized objects, and a
   *  record must be able to hold them unchanged. */
  values: Record<string, unknown>;
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


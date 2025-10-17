import CollectionQuery from './Collection/CollectionQuery';
import CollectionRecordQuery from './Collection/CollectionRecordQuery';
import CollectionRecordsQuery from './Collection/CollectionRecordsQuery';
import CollectionsQuery from './Collection/CollectionsQuery';
import InitQuery from './InitQuery';
import SegmentQuery from './Segment/SegmentQuery';
import SegmentsQuery from './Segment/SegmentsQuery';

import type { TCollectionQuery } from './Collection/CollectionQuery';
import type { TCollectionRecordQuery } from './Collection/CollectionRecordQuery';
import type { TCollectionRecordsQuery } from './Collection/CollectionRecordsQuery';
import type { TCollectionsQuery } from './Collection/CollectionsQuery';
import type { TInitQuery } from './InitQuery';
import type { TSegmentQuery } from './Segment/SegmentQuery';
import type { TSegmentsQuery } from './Segment/SegmentsQuery';

export type QueriesMap = {
  Init: TInitQuery;
  Collection: TCollectionQuery;
  Collections: TCollectionsQuery;
  CollectionRecords: TCollectionRecordsQuery;
  CollectionRecord: TCollectionRecordQuery;
  Segment: TSegmentQuery;
  Segments: TSegmentsQuery;
};

const Queries = {
  Init: InitQuery,
  Collection: CollectionQuery,
  Collections: CollectionsQuery,
  CollectionRecords: CollectionRecordsQuery,
  CollectionRecord: CollectionRecordQuery,
  Segment: SegmentQuery,
  Segments: SegmentsQuery
};

export default Queries;

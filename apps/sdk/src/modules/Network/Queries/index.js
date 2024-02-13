// Relatives
import InitQuery from './InitQuery';

import CollectionQuery from './Collection/CollectionQuery';
import CollectionsQuery from './Collection/CollectionsQuery';
import CollectionRecordsQuery from './Collection/CollectionRecordsQuery';
import CollectionRecordQuery from './Collection/CollectionRecordQuery';

import SegmentQuery from './Segment/SegmentQuery';

const Queries = {
  Init: InitQuery,
  Collection: CollectionQuery,
  Collections: CollectionsQuery,
  CollectionRecords: CollectionRecordsQuery,
  CollectionRecord: CollectionRecordQuery,
  Segment: SegmentQuery
};

export default Queries;

// Relatives
import InitQuery from './InitQuery';

import SpaceLatestRevisionQuery from './Space/SpaceLatestRevisionQuery';
import SpaceResourcesQuery from './Space/SpaceResourcesQuery';
import SpaceDeploymentsQuery from './Space/SpaceDeploymentsQuery';

import PluginsQuery from './PluginsQuery';

import CollectionQuery from './Collection/CollectionQuery';
import CollectionsQuery from './Collection/CollectionsQuery';
import CollectionRecordsQuery from './Collection/CollectionRecordsQuery';
import CollectionRecordQuery from './Collection/CollectionRecordQuery';

import SegmentQuery from './Segment/SegmentQuery';
import SegmentsQuery from './Segment/SegmentsQuery';

const Queries = {
  Init: InitQuery,
  SpaceLatestRevision: SpaceLatestRevisionQuery,
  SpaceResources: SpaceResourcesQuery,
  SpaceDeployments: SpaceDeploymentsQuery,
  Plugins: PluginsQuery,
  Collection: CollectionQuery,
  Collections: CollectionsQuery,
  CollectionRecords: CollectionRecordsQuery,
  CollectionRecord: CollectionRecordQuery,
  Segment: SegmentQuery,
  Segments: SegmentsQuery
};

export default Queries;

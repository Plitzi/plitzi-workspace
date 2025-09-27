import CollectionQuery from './Collection/CollectionQuery';
import CollectionRecordQuery from './Collection/CollectionRecordQuery';
import CollectionRecordsQuery from './Collection/CollectionRecordsQuery';
import CollectionsQuery from './Collection/CollectionsQuery';
import InitQuery from './InitQuery';
import PluginsQuery from './PluginsQuery';
import SegmentQuery from './Segment/SegmentQuery';
import SegmentsQuery from './Segment/SegmentsQuery';
import SpaceCdnsQuery from './Space/SpaceCdnsQuery';
import SpaceDeploymentsQuery from './Space/SpaceDeploymentsQuery';
import SpaceLatestRevisionQuery from './Space/SpaceLatestRevisionQuery';
import SpaceResourcesQuery from './Space/SpaceResourcesQuery';

const Queries = {
  Init: InitQuery,
  SpaceLatestRevision: SpaceLatestRevisionQuery,
  SpaceResources: SpaceResourcesQuery,
  SpaceDeployments: SpaceDeploymentsQuery,
  SpaceCdns: SpaceCdnsQuery,
  Plugins: PluginsQuery,
  Collection: CollectionQuery,
  Collections: CollectionsQuery,
  CollectionRecords: CollectionRecordsQuery,
  CollectionRecord: CollectionRecordQuery,
  Segment: SegmentQuery,
  Segments: SegmentsQuery
};

export default Queries;

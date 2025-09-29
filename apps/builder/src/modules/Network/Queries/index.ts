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

import type { TCollectionQuery } from './Collection/CollectionQuery';
import type { TCollectionRecordQuery } from './Collection/CollectionRecordQuery';
import type { TCollectionRecordsQuery } from './Collection/CollectionRecordsQuery';
import type { TCollectionsQuery } from './Collection/CollectionsQuery';
import type { TInitQuery } from './InitQuery';
import type { TPluginsQuery } from './PluginsQuery';
import type { TSegmentQuery } from './Segment/SegmentQuery';
import type { TSegmentsQuery } from './Segment/SegmentsQuery';
import type { TSpaceCdnsQuery } from './Space/SpaceCdnsQuery';
import type { TSpaceDeploymentsQuery } from './Space/SpaceDeploymentsQuery';
import type { TSpaceLatestRevisionQuery } from './Space/SpaceLatestRevisionQuery';
import type { TSpaceResourcesQuery } from './Space/SpaceResourcesQuery';

export type QueriesMap = {
  Init: TInitQuery;
  SpaceLatestRevision: TSpaceLatestRevisionQuery;
  SpaceResources: TSpaceResourcesQuery;
  SpaceDeployments: TSpaceDeploymentsQuery;
  SpaceCdns: TSpaceCdnsQuery;
  Plugins: TPluginsQuery;
  Collection: TCollectionQuery;
  Collections: TCollectionsQuery;
  CollectionRecords: TCollectionRecordsQuery;
  CollectionRecord: TCollectionRecordQuery;
  Segment: TSegmentQuery;
  Segments: TSegmentsQuery;
};

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

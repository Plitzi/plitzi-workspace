import InitQuery from './InitQuery';
import PluginsQuery from './PluginsQuery';
import SegmentQuery from './Segment/SegmentQuery';
import SegmentsQuery from './Segment/SegmentsQuery';
import SpaceCdnsQuery from './Space/SpaceCdnsQuery';
import SpaceCredentialsQuery from './Space/SpaceCredentialsQuery';
import SpaceDeploymentsQuery from './Space/SpaceDeploymentsQuery';
import SpaceLatestRevisionQuery from './Space/SpaceLatestRevisionQuery';
import SpaceResourcesQuery from './Space/SpaceResourcesQuery';

import type { TInitQuery } from './InitQuery';
import type { TPluginsQuery } from './PluginsQuery';
import type { TSegmentQuery } from './Segment/SegmentQuery';
import type { TSegmentsQuery } from './Segment/SegmentsQuery';
import type { TSpaceCdnsQuery } from './Space/SpaceCdnsQuery';
import type { TSpaceCredentialsQuery } from './Space/SpaceCredentialsQuery';
import type { TSpaceDeploymentsQuery } from './Space/SpaceDeploymentsQuery';
import type { TSpaceLatestRevisionQuery } from './Space/SpaceLatestRevisionQuery';
import type { TSpaceResourcesQuery } from './Space/SpaceResourcesQuery';

export type BuilderQueriesMap = {
  Init: TInitQuery;
  SpaceLatestRevision: TSpaceLatestRevisionQuery;
  SpaceResources: TSpaceResourcesQuery;
  SpaceDeployments: TSpaceDeploymentsQuery;
  SpaceCdns: TSpaceCdnsQuery;
  SpaceCredentials: TSpaceCredentialsQuery;
  Plugins: TPluginsQuery;
  Segment: TSegmentQuery;
  Segments: TSegmentsQuery;
};

const BuilderQueries = {
  Init: InitQuery,
  SpaceLatestRevision: SpaceLatestRevisionQuery,
  SpaceResources: SpaceResourcesQuery,
  SpaceDeployments: SpaceDeploymentsQuery,
  SpaceCdns: SpaceCdnsQuery,
  SpaceCredentials: SpaceCredentialsQuery,
  Plugins: PluginsQuery,
  Segment: SegmentQuery,
  Segments: SegmentsQuery
};

export default BuilderQueries;

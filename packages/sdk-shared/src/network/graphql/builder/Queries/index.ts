import InitQuery from './InitQuery';
import PluginsQuery from './PluginsQuery';
import SegmentQuery from './Segment/SegmentQuery';
import SegmentsQuery from './Segment/SegmentsQuery';
import SpaceActionEventsQuery from './Space/SpaceActionEventsQuery';
import SpaceActionsQuery from './Space/SpaceActionsQuery';
import SpaceActionTasksQuery from './Space/SpaceActionTasksQuery';
import SpaceCdnsQuery from './Space/SpaceCdnsQuery';
import SpaceConnectorsQuery from './Space/SpaceConnectorsQuery';
import SpaceCredentialsQuery from './Space/SpaceCredentialsQuery';
import SpaceDeploymentsQuery from './Space/SpaceDeploymentsQuery';
import SpaceLatestRevisionQuery from './Space/SpaceLatestRevisionQuery';
import SpaceResourcesQuery from './Space/SpaceResourcesQuery';

import type { TInitQuery } from './InitQuery';
import type { TPluginsQuery } from './PluginsQuery';
import type { TSegmentQuery } from './Segment/SegmentQuery';
import type { TSegmentsQuery } from './Segment/SegmentsQuery';
import type { TSpaceActionEventsQuery } from './Space/SpaceActionEventsQuery';
import type { TSpaceActionsQuery } from './Space/SpaceActionsQuery';
import type { TSpaceActionTasksQuery } from './Space/SpaceActionTasksQuery';
import type { TSpaceCdnsQuery } from './Space/SpaceCdnsQuery';
import type { TSpaceConnectorsQuery } from './Space/SpaceConnectorsQuery';
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
  SpaceActions: TSpaceActionsQuery;
  SpaceActionEvents: TSpaceActionEventsQuery;
  SpaceActionTasks: TSpaceActionTasksQuery;
  SpaceConnectors: TSpaceConnectorsQuery;
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
  SpaceActions: SpaceActionsQuery,
  SpaceActionEvents: SpaceActionEventsQuery,
  SpaceActionTasks: SpaceActionTasksQuery,
  SpaceConnectors: SpaceConnectorsQuery,
  SpaceCredentials: SpaceCredentialsQuery,
  Plugins: PluginsQuery,
  Segment: SegmentQuery,
  Segments: SegmentsQuery
};

export default BuilderQueries;

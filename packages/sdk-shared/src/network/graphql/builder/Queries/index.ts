import InitQuery from './InitQuery';
import SegmentQuery from './Segment/SegmentQuery';
import SegmentsQuery from './Segment/SegmentsQuery';
import SpaceActionEventsQuery from './Space/SpaceActionEventsQuery';
import SpaceActionsQuery from './Space/SpaceActionsQuery';
import SpaceActionTasksQuery from './Space/SpaceActionTasksQuery';
import SpaceCdnsQuery from './Space/SpaceCdnsQuery';
import SpaceChangesQuery from './Space/SpaceChangesQuery';
import SpaceCheckActionQuery from './Space/SpaceCheckActionQuery';
import SpaceConnectorsQuery from './Space/SpaceConnectorsQuery';
import SpaceCredentialsQuery from './Space/SpaceCredentialsQuery';
import SpaceDeploymentsQuery from './Space/SpaceDeploymentsQuery';
import SpaceIssuesQuery from './Space/SpaceIssuesQuery';
import SpaceLatestRevisionQuery from './Space/SpaceLatestRevisionQuery';
import SpaceQuotaQuery from './Space/SpaceQuotaQuery';
import SpaceResourcesQuery from './Space/SpaceResourcesQuery';

import type { TInitQuery } from './InitQuery';
import type { TSegmentQuery } from './Segment/SegmentQuery';
import type { TSegmentsQuery } from './Segment/SegmentsQuery';
import type { TSpaceActionEventsQuery } from './Space/SpaceActionEventsQuery';
import type { TSpaceActionsQuery } from './Space/SpaceActionsQuery';
import type { TSpaceActionTasksQuery } from './Space/SpaceActionTasksQuery';
import type { TSpaceCdnsQuery } from './Space/SpaceCdnsQuery';
import type { TSpaceChangesQuery } from './Space/SpaceChangesQuery';
import type { TSpaceCheckActionQuery } from './Space/SpaceCheckActionQuery';
import type { TSpaceConnectorsQuery } from './Space/SpaceConnectorsQuery';
import type { TSpaceCredentialsQuery } from './Space/SpaceCredentialsQuery';
import type { TSpaceDeploymentsQuery } from './Space/SpaceDeploymentsQuery';
import type { TSpaceIssuesQuery } from './Space/SpaceIssuesQuery';
import type { TSpaceLatestRevisionQuery } from './Space/SpaceLatestRevisionQuery';
import type { TSpaceQuotaQuery } from './Space/SpaceQuotaQuery';
import type { TSpaceResourcesQuery } from './Space/SpaceResourcesQuery';

// The quota shape is read by whatever renders it (the builder's own meter today), so it travels with the query.
export type { TQuotaPlane, TSpaceQuota } from './Space/SpaceQuotaQuery';
export type { TSpaceIssue, TSpaceIssues } from './Space/SpaceIssuesQuery';
export type { TSnapshotMarker, TSpaceChanges } from './Space/SpaceChangesQuery';

export type BuilderQueriesMap = {
  Init: TInitQuery;
  SpaceLatestRevision: TSpaceLatestRevisionQuery;
  SpaceQuota: TSpaceQuotaQuery;
  SpaceIssues: TSpaceIssuesQuery;
  SpaceChanges: TSpaceChangesQuery;
  SpaceResources: TSpaceResourcesQuery;
  SpaceDeployments: TSpaceDeploymentsQuery;
  SpaceCdns: TSpaceCdnsQuery;
  SpaceActions: TSpaceActionsQuery;
  SpaceActionEvents: TSpaceActionEventsQuery;
  SpaceCheckAction: TSpaceCheckActionQuery;
  SpaceActionTasks: TSpaceActionTasksQuery;
  SpaceConnectors: TSpaceConnectorsQuery;
  SpaceCredentials: TSpaceCredentialsQuery;
  Segment: TSegmentQuery;
  Segments: TSegmentsQuery;
};

const BuilderQueries = {
  Init: InitQuery,
  SpaceLatestRevision: SpaceLatestRevisionQuery,
  SpaceQuota: SpaceQuotaQuery,
  SpaceIssues: SpaceIssuesQuery,
  SpaceChanges: SpaceChangesQuery,
  SpaceResources: SpaceResourcesQuery,
  SpaceDeployments: SpaceDeploymentsQuery,
  SpaceCdns: SpaceCdnsQuery,
  SpaceActions: SpaceActionsQuery,
  SpaceActionEvents: SpaceActionEventsQuery,
  SpaceCheckAction: SpaceCheckActionQuery,
  SpaceActionTasks: SpaceActionTasksQuery,
  SpaceConnectors: SpaceConnectorsQuery,
  SpaceCredentials: SpaceCredentialsQuery,
  Segment: SegmentQuery,
  Segments: SegmentsQuery
};

export default BuilderQueries;

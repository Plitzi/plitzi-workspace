import { gql } from '@apollo/client/core';

import type { SpaceChange } from '../../../../../history';

/**
 * A published revision on the timeline. `upToSeq` is the last change recorded before it was published — what it
 * includes — or null when none is recorded. Indicative: derived from the dates.
 */
export type TSnapshotMarker = {
  revision: number;
  environment: string;
  description: string;
  publishedAt: number;
  upToSeq: number | null;
};

/** A page of the space's change history, newest first. `nextBefore` pages further back; null at the end. */
export type TSpaceChanges = {
  changes: Omit<SpaceChange, 'spaceId' | 'environment'>[];
  snapshots: TSnapshotMarker[];
  nextBefore: number | null;
};

export type TSpaceChangesQuery = { SpaceChanges: TSpaceChanges };

const SpaceChangesQuery = gql`
  query SpaceChangesQuery(
    $environment: String!
    $before: Int
    $entityId: String
    $origin: String
    $userId: Int
    $since: Float
    $limit: Int
  ) {
    SpaceChanges(
      environment: $environment
      before: $before
      entityId: $entityId
      origin: $origin
      userId: $userId
      since: $since
      limit: $limit
    ) {
      changes {
        seq
        at
        document
        author {
          userId
          name
        }
        origin
        client
        batch
        summary
        entries
        truncated
      }
      snapshots {
        revision
        environment
        description
        publishedAt
        upToSeq
      }
      nextBefore
    }
  }
`;

export default SpaceChangesQuery;

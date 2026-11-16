import type { SpaceVersionChanges } from '../../../../../types';

export type TSpaceVersionChangesQuery = { SpaceVersionChanges: SpaceVersionChanges | null };

/** What changes going from one version to another; none when either is not there. */
const SpaceVersionChangesQuery = /* GraphQL */ `
  query SpaceVersionChangesQuery(
    $fromEnvironment: String!
    $fromRevision: Int
    $toEnvironment: String!
    $toRevision: Int
  ) {
    SpaceVersionChanges(
      fromEnvironment: $fromEnvironment
      fromRevision: $fromRevision
      toEnvironment: $toEnvironment
      toRevision: $toRevision
    ) {
      pages {
        added
        removed
        changed
      }
      layouts
      components
      styles
      fonts
      settings
      plugins {
        added
        removed
        changed
      }
      actions
      connectors
      functions
      runtime
      total
    }
  }
`;

export default SpaceVersionChangesQuery;

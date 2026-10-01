import type { SpaceVersionContents } from '../../../../../types';

export type TSpaceVersionContentsQuery = { SpaceVersionContents: SpaceVersionContents | null };

/** What one version of the space is made of: the draft a snapshot would freeze, or a snapshot (its latest by default). */
const SpaceVersionContentsQuery = /* GraphQL */ `
  query SpaceVersionContentsQuery($environment: String!, $revision: Int) {
    SpaceVersionContents(environment: $environment, revision: $revision) {
      environment
      revision
      snapshot {
        description
        publishedAt
      }
      pages
      layouts
      elements
      plugins {
        type
        source
      }
      actions
      connectors
      functions {
        tasks
        routes
      }
      runtime {
        source
      }
    }
  }
`;

export default SpaceVersionContentsQuery;

import { gql } from '@apollo/client/core';

export type TSpaceLatestRevisionQuery = {
  SpaceLatestRevision: { snapshot: { revision: number; publishedAt: Date; description: string } | null } | null;
};

const SpaceLatestRevisionQuery = gql`
  query SpaceLatestRevisionQuery($environment: String!) {
    SpaceLatestRevision(environment: $environment) {
      snapshot {
        description
        revision
        publishedAt
      }
    }
  }
`;

export default SpaceLatestRevisionQuery;

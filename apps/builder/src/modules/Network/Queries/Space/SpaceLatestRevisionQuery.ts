import { gql } from '@apollo/client/core';

export type TSpaceLatestRevisionQuery = {
  SpaceLatestRevision: { snapshot: { revision: number } } | null;
};

const SpaceLatestRevisionQuery = gql`
  query SpaceLatestRevisionQuery($environment: String!) {
    SpaceLatestRevision(environment: $environment) {
      snapshot {
        revision
      }
    }
  }
`;

export default SpaceLatestRevisionQuery;

import { gql } from '@apollo/client/core';

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

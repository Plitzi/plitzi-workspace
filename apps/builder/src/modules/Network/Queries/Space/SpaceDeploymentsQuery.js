// Packages
import { gql } from '@apollo/client/core';

const SpaceDeploymentsQuery = gql`
  query SpaceDeploymentsQuery($filter: PluginInput, $page: Int, $pageSize: Int, $offset: Int) {
    SpaceDeployments(filter: $filter, page: $page, pageSize: $pageSize, offset: $offset) {
      edges {
        id
        environment
        revision
        domain
        isVerified
        default
        createdAt
        updatedAt
      }
      pageInfo {
        hasPrevPage
        hasNextPage
        from
        to
        total
      }
    }
  }
`;

export default SpaceDeploymentsQuery;

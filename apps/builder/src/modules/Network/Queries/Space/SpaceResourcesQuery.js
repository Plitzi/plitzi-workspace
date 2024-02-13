// Packages
import { gql } from '@apollo/client/core';

const SpaceResourcesQuery = gql`
  query SpaceResourcesQuery($filter: PluginInput, $page: Int, $pageSize: Int, $offset: Int) {
    SpaceResources(filter: $filter, page: $page, pageSize: $pageSize, offset: $offset) {
      edges {
        id
        name
        type
        size
        path
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

export default SpaceResourcesQuery;

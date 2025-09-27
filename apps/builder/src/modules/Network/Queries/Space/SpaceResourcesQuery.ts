import { gql } from '@apollo/client/core';

const SpaceResourcesQuery = gql`
  query SpaceResourcesQuery($cdnIdentifier: String!, $filter: ResourceInput, $page: Int, $pageSize: Int, $offset: Int) {
    SpaceResources(cdnIdentifier: $cdnIdentifier, filter: $filter, page: $page, pageSize: $pageSize, offset: $offset) {
      edges {
        id
        cdnIdentifier
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

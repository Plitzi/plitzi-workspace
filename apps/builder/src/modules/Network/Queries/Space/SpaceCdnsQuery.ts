import { gql } from '@apollo/client/core';

const SpaceCdnsQuery = gql`
  query SpaceCdnsQuery($filter: CdnInput, $page: Int, $pageSize: Int, $offset: Int) {
    SpaceCdns(filter: $filter, page: $page, pageSize: $pageSize, offset: $offset) {
      edges {
        id
        identifier
        name
        domain
        provider
        region
        endpoint
        bucketName
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

export default SpaceCdnsQuery;

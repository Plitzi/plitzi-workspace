import { gql } from '@apollo/client/core';

import type { Cdn, PageInfo } from '../../../../../types';

export type TSpaceCdnsQuery = {
  SpaceCdns: { edges: Cdn[]; pageInfo: PageInfo };
};

const SpaceCdnsQuery = gql`
  query SpaceCdnsQuery($filter: CdnInput, $page: Int, $pageSize: Int, $offset: Int) {
    SpaceCdns(filter: $filter, page: $page, pageSize: $pageSize, offset: $offset) {
      edges {
        identifier
        name
        domain
        provider
        region
        endpoint
        bucketName
        prefix
        credential {
          identifier
        }
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

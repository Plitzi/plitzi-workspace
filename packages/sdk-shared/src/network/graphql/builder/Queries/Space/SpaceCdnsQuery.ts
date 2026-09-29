import { CDN_FIELDS } from '../../fragments/cdnFields';

import type { Cdn, PageInfo } from '../../../../../types';

export type TSpaceCdnsQuery = {
  SpaceCdns: { edges: Cdn[]; pageInfo: PageInfo };
};

const SpaceCdnsQuery = /* GraphQL */ `
  query SpaceCdnsQuery($filter: CdnInput, $page: Int, $pageSize: Int, $offset: Int) {
    SpaceCdns(filter: $filter, page: $page, pageSize: $pageSize, offset: $offset) {
      edges {
        ${CDN_FIELDS}
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

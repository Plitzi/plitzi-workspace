import { gql } from '@apollo/client/core';

import type { CollectionRaw, PageInfo } from '@plitzi/sdk-shared';

export type TCollectionsQuery = {
  Collections: { edges: CollectionRaw[]; pageInfo: PageInfo };
};

const CollectionsQuery = gql`
  query CollectionsQuery($filter: JsonObject, $cursor: String, $limit: Int) {
    Collections(filter: $filter, cursor: $cursor, limit: $limit) {
      edges {
        id
        name
        mamePlural
        description
        privacy
        fields
        records(limit: 20) {
          edges {
            id
            status
            values
            createdAt
            updatedAt
            publishedAt
          }
          pageInfo {
            hasPrevPage
            hasNextPage
            prevCursor
            nextCursor
            from
            to
            total
          }
        }
      }
    }
  }
`;

export default CollectionsQuery;

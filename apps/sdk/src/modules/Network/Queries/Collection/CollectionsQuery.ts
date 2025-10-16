import { gql } from 'graphql-tag';

import type { CollectionRaw, PageInfo } from '@plitzi/sdk-shared';

export type TCollectionsQuery = {
  Collections: { edges: CollectionRaw[]; pageInfo: PageInfo };
};

const CollectionsQuery = gql`
  query CollectionsQuery($filter: JsonObject, $cursor: String, $limit: Int) {
    Collections(cursor: $cursor, limit: $limit) {
      edges {
        id
        name
        description
        privacy
        fields
        records(limit: 20) {
          edges {
            id
            values
            createdAt
            updatedAt
          }
        }
      }
    }
  }
`;

export default CollectionsQuery;

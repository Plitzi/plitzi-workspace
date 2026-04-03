import { gql } from '@apollo/client/core';

import type { CollectionRaw } from '../../../../../types';

export type TCollectionQuery = {
  Collection: CollectionRaw;
};

const CollectionQuery = gql`
  query CollectionQuery($id: String!, $recordsFilter: JsonObject) {
    Collection(id: $id) {
      id
      name
      namePlural
      description
      privacy
      fields
      records(filter: $recordsFilter, limit: 20) {
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
`;

export default CollectionQuery;

import { gql } from 'graphql-tag';

import type { CollectionRaw } from '@plitzi/sdk-shared';

export type TCollectionQuery = {
  Collection: CollectionRaw;
};

const CollectionQuery = gql`
  query CollectionQuery($id: String!, $recordsFilter: JsonObject) {
    Collection(id: $id) {
      id
      name
      description
      privacy
      fields
      records(filter: $recordsFilter, limit: 20) {
        edges {
          id
          values
          createdAt
          updatedAt
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

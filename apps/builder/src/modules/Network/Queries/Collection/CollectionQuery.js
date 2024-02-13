// Packages
import { gql } from '@apollo/client/core';

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

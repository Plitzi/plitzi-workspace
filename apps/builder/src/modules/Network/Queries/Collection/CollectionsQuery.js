// Packages
import { gql } from '@apollo/client/core';

const CollectionsQuery = gql`
  query CollectionsQuery($filter: CollectionInput, $cursor: String, $limit: Int) {
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
  }
`;

export default CollectionsQuery;

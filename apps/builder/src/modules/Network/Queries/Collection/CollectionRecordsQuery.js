// Packages
import { gql } from '@apollo/client/core';

const CollectionRecordsQuery = gql`
  query CollectionRecordsQuery($collectionId: String!, $filter: JsonObject, $cursor: String, $limit: Int) {
    CollectionRecords(collectionId: $collectionId, filter: $filter, cursor: $cursor, limit: $limit) {
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
`;

export default CollectionRecordsQuery;

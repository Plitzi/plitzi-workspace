// Packages
import { gql } from 'graphql-tag';

const CollectionRecordsQuery = gql`
  query CollectionRecordsQuery($collectionId: String!, $filter: JsonObject, $cursor: String, $limit: Int) {
    CollectionRecords(collectionId: $collectionId, filter: $filter, cursor: $cursor, limit: $limit) {
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
`;

export default CollectionRecordsQuery;

// Packages
import { gql } from 'graphql-tag';

const CollectionsQuery = gql`
  query CollectionsQuery($filter: CollectionInput, $cursor: String, $limit: Int) {
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

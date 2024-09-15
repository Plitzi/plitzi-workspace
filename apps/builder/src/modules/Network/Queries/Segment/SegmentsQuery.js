// Packages
import { gql } from '@apollo/client/core';

const SegmentsQuery = gql`
  query SegmentsQuery($environment: String!, $filter: JsonObject, $cursor: String, $limit: Int) {
    Segments(environment: $environment, filter: $filter, cursor: $cursor, limit: $limit) {
      edges {
        id
        identifier
        definition
        schema {
          flat {
            id
            definition {
              label
              type
              initialState
              styleSelectors
              bindings
              interactions
              parentId
              rootId
              items
            }
            attributes
          }
        }
        style {
          variables
          platform
          cache
        }
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

export default SegmentsQuery;

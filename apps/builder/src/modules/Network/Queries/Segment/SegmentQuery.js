// Packages
import { gql } from '@apollo/client/core';

const SegmentQuery = gql`
  query SegmentQuery($id: String, $identifier: String, $environment: String!) {
    Segment(id: $id, identifier: $identifier, environment: $environment) {
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
  }
`;

export default SegmentQuery;

// Packages
import { gql } from 'graphql-tag';

const SegmentQuery = gql`
  query SegmentQuery($id: String, $identifier: String, $environment: String!) {
    Segment(id: $id, identifier: $identifier, environment: $environment) {
      id
      identifier
      definition
      schema {
        variables {
          name
          category
          type
          value
          subValues {
            value
            when
          }
        }
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
        platform
        cache
      }
      createdAt
      updatedAt
    }
  }
`;

export default SegmentQuery;

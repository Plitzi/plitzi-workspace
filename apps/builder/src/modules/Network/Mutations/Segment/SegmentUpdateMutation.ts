import { gql } from '@apollo/client/core';

const SegmentUpdateMutation = gql`
  mutation SegmentUpdateMutation($id: String!, $segment: Json!) {
    SegmentUpdate(id: $id, segment: $segment) {
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
    }
  }
`;

export default SegmentUpdateMutation;

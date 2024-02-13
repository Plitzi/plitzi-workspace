// Packages
import { gql } from '@apollo/client/core';

const SegmentAddMutation = gql`
  mutation SegmentAddMutation(
    $name: String!
    $description: String!
    $baseElementId: String
    $elements: Json
    $style: Json
  ) {
    SegmentAdd(
      name: $name
      description: $description
      baseElementId: $baseElementId
      elements: $elements
      style: $style
    ) {
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
        platform
        cache
      }
    }
  }
`;

export default SegmentAddMutation;

import { gql } from '@apollo/client/core';

import type { SegmentRaw } from '../../../../../types';

export type TSegmentAddMutation = SegmentRaw;

const SegmentAddMutation = gql`
  mutation SegmentAddMutation(
    $name: String!
    $description: String!
    $baseElementId: String
    $elements: Json
    $style: Json
    $variables: [SpaceVariableInput]
  ) {
    SegmentAdd(
      name: $name
      description: $description
      baseElementId: $baseElementId
      elements: $elements
      style: $style
      variables: $variables
    ) {
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
          idRef
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

export default SegmentAddMutation;

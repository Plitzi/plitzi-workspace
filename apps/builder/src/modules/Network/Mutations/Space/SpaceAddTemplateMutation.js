// Packages
import { gql } from '@apollo/client/core';

const SpaceAddTemplateMutation = gql`
  mutation SpaceAddTemplateMutation(
    $environment: String!
    $element: Json!
    $styles: Json!
    $dropPosition: String!
    $to: String!
    $initialItems: [Json]!
  ) {
    SpaceAddTemplate(
      environment: $environment
      element: $element
      styles: $styles
      dropPosition: $dropPosition
      to: $to
      initialItems: $initialItems
    ) {
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
`;

export default SpaceAddTemplateMutation;

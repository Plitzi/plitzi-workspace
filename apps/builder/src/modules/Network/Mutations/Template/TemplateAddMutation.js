// Packages
import { gql } from '@apollo/client/core';

const TemplateAddMutation = gql`
  mutation TemplateAddMutation(
    $name: String!
    $description: String!
    $baseElementId: String
    $elements: Json
    $style: Json
  ) {
    TemplateAdd(
      name: $name
      description: $description
      baseElementId: $baseElementId
      elements: $elements
      style: $style
    ) {
      id
      definition
      schema
      style
    }
  }
`;

export default TemplateAddMutation;

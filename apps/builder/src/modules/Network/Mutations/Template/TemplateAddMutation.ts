import { gql } from '@apollo/client/core';

import type { Template } from '@pmodules/Templates/TemplatesContext';

export type TTemplateAddMutation = Template;

const TemplateAddMutation = gql`
  mutation TemplateAddMutation(
    $name: String!
    $description: String!
    $baseElementId: String
    $elements: Json
    $variables: [SpaceVariableInput]
    $style: Json
  ) {
    TemplateAdd(
      name: $name
      description: $description
      baseElementId: $baseElementId
      elements: $elements
      variables: $variables
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

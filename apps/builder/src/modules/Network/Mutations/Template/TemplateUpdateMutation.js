// Packages
import { gql } from '@apollo/client/core';

const TemplateUpdateMutation = gql`
  mutation TemplateUpdateMutation($id: String!, $template: Json!) {
    TemplateUpdate(id: $id, template: $template) {
      id
      definition
      schema
      style
    }
  }
`;

export default TemplateUpdateMutation;

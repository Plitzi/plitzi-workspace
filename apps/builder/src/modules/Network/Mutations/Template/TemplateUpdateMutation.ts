import { gql } from '@apollo/client/core';

import type { Template } from '@pmodules/Templates/TemplatesContext';

export type TTemplateUpdateMutation = Template;

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

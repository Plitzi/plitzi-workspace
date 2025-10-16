import { gql } from '@apollo/client/core';

import type { Template } from '@pmodules/Templates/TemplatesContext';

export type TTemplateRemoveMutation = Template;

const TemplateRemoveMutation = gql`
  mutation TemplateRemoveMutation($id: String!) {
    TemplateRemove(id: $id) {
      id
    }
  }
`;

export default TemplateRemoveMutation;

// Packages
import { gql } from '@apollo/client/core';

const TemplateRemoveMutation = gql`
  mutation TemplateRemoveMutation($id: String!) {
    TemplateRemove(id: $id) {
      id
    }
  }
`;

export default TemplateRemoveMutation;

import { gql } from '@apollo/client/core';

const StyleRemoveVariableMutation = gql`
  mutation StyleRemoveVariableMutation($environment: String!, $category: String!, $name: String!) {
    StyleRemoveVariable(environment: $environment, category: $category, name: $name) {
      id
      variables
      platform
      mode
      cache
    }
  }
`;

export default StyleRemoveVariableMutation;

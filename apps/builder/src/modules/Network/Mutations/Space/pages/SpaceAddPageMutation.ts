import { gql } from '@apollo/client/core';

const SpaceAddPageMutation = gql`
  mutation SpaceAddPageMutation($environment: String!, $name: String!, $pageFolder: String) {
    SpaceAddPage(environment: $environment, name: $name, pageFolder: $pageFolder) {
      id
      definition
      attributes
    }
  }
`;

export default SpaceAddPageMutation;

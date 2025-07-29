import { gql } from '@apollo/client/core';

const SpaceUpdatePageMutation = gql`
  mutation SpaceUpdatePageMutation($environment: String!, $page: Json!) {
    SpaceUpdatePage(environment: $environment, page: $page) {
      id
      definition
      attributes
    }
  }
`;

export default SpaceUpdatePageMutation;

import { gql } from '@apollo/client/core';

const SpaceRemovePageMutation = gql`
  mutation SpaceRemovePageMutation($environment: String!, $pageId: String!) {
    SpaceRemovePage(environment: $environment, pageId: $pageId) {
      id
    }
  }
`;

export default SpaceRemovePageMutation;

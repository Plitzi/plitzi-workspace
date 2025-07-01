// Packages
import { gql } from '@apollo/client/core';

const SpaceHomePageMutation = gql`
  mutation SpaceHomePageMutation($environment: String!, $pageId: String!) {
    SpaceHomePage(environment: $environment, pageId: $pageId) {
      id
    }
  }
`;

export default SpaceHomePageMutation;

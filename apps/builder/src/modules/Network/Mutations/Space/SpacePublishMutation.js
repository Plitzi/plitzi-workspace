// Packages
import { gql } from '@apollo/client/core';

const SpacePublishMutation = gql`
  mutation SpacePublish($environment: String!, $description: String!) {
    SpacePublish(environment: $environment, description: $description) {
      environment
      description
      revision
      publishedAt
    }
  }
`;

export default SpacePublishMutation;

import { gql } from '@apollo/client/core';

export type TSpacePublishMutation = {
  revision: number;
  environment: string;
  description?: string;
  publishedAt: number;
};

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

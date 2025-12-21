import { gql } from '@apollo/client/core';

export type TSegmentPublishMutation = {
  environment: 'production' | 'staging' | 'development';
  revision: string;
  description: string;
};

const SegmentPublishMutation = gql`
  mutation SegmentPublish($environment: String!, $description: String!, $contextId: String!) {
    SegmentPublish(environment: $environment, description: $description, contextId: $contextId) {
      environment
      description
      revision
      publishedAt
    }
  }
`;

export default SegmentPublishMutation;

// Packages
import { gql } from '@apollo/client/core';

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

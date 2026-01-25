import { gql } from '@apollo/client/core';

import type { Environment } from '@plitzi/sdk-shared';

export type TSegmentPublishMutation = {
  environment: Omit<Environment, 'main'>;
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

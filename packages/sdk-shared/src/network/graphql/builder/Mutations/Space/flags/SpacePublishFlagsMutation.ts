import type { TSpacePublishMutation } from '../SpacePublishMutation';

export type TSpacePublishFlagsMutation = TSpacePublishMutation;

/**
 * Publishes the draft's flags and nothing else: a new revision of `environment` that is its latest one with the
 * flags `main` declares now. How a flag is turned in production without shipping whatever else is being edited.
 */
const SpacePublishFlagsMutation = /* GraphQL */ `
  mutation SpacePublishFlagsMutation($environment: String!, $description: String!) {
    SpacePublishFlags(environment: $environment, description: $description) {
      environment
      description
      revision
      publishedAt
    }
  }
`;

export default SpacePublishFlagsMutation;

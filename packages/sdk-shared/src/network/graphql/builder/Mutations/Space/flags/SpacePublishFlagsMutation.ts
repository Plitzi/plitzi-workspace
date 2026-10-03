export type TSpacePublishFlagsMutation = {
  environment: string;
  /** The content's hash: what every cache of the environment's pages is keyed by. */
  hash: string;
  publishedAt: string;
};

/**
 * Publishes the draft's flags to an environment, and only them. Flags are not part of a snapshot — an environment has
 * one set, shared by every revision it serves — so this makes no revision: the pages the environment serves now switch.
 */
const SpacePublishFlagsMutation = /* GraphQL */ `
  mutation SpacePublishFlagsMutation($environment: String!, $description: String!) {
    SpacePublishFlags(environment: $environment, description: $description) {
      environment
      hash
      publishedAt
    }
  }
`;

export default SpacePublishFlagsMutation;

export type TSpacePublishMutation = {
  revision: number;
  environment: string;
  description?: string;
  publishedAt: number;
};

const SpacePublishMutation = /* GraphQL */ `
  mutation SpacePublishMutation($environment: String!, $description: String!) {
    SpacePublish(environment: $environment, description: $description) {
      environment
      description
      revision
      publishedAt
    }
  }
`;

export default SpacePublishMutation;

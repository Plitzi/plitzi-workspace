import type { SpaceDeployment } from '../../../../../types';

export type TSpaceDeployMutation = SpaceDeployment;

const SpaceDeployMutation = /* GraphQL */ `
  mutation SpaceDeployMutation(
    $environment: String!
    $domain: String!
    $revision: Int
    $credentialIdentifier: String
    $deploy: Boolean
  ) {
    SpaceDeploy(
      environment: $environment
      domain: $domain
      revision: $revision
      credentialIdentifier: $credentialIdentifier
      deploy: $deploy
    ) {
      id
      environment
      domain
      revision
      isVerified
      default
      mode
      provider
      deployId
      credential {
        identifier
      }
      createdAt
      updatedAt
    }
  }
`;

export default SpaceDeployMutation;

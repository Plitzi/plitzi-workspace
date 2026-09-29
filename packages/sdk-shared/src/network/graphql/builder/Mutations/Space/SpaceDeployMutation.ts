import type { SpaceDeployment } from '../../../../../types';

export type TSpaceDeployMutation = SpaceDeployment;

const SpaceDeployMutation = /* GraphQL */ `
  mutation SpaceDeployMutation($environment: String!, $domain: String!, $revision: Int, $credentialIdentifier: String) {
    SpaceDeploy(
      environment: $environment
      domain: $domain
      revision: $revision
      credentialIdentifier: $credentialIdentifier
    ) {
      id
      environment
      domain
      revision
      isVerified
      default
      credential {
        identifier
      }
      createdAt
      updatedAt
    }
  }
`;

export default SpaceDeployMutation;

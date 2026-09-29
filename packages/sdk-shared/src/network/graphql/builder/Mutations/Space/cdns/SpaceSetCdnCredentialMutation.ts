import type { Cdn } from '../../../../../../types';

export type TSpaceSetCdnCredentialMutation = Cdn;

const SpaceSetCdnCredentialMutation = /* GraphQL */ `
  mutation SpaceSetCdnCredentialMutation($identifier: String!, $credentialIdentifier: String!) {
    SpaceSetCdnCredential(identifier: $identifier, credentialIdentifier: $credentialIdentifier) {
      name
      identifier
      provider
      region
      endpoint
      bucketName
      prefix
      credential {
        identifier
      }
    }
  }
`;

export default SpaceSetCdnCredentialMutation;

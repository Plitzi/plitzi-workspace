import { gql } from '@apollo/client/core';

import type { Cdn } from '@plitzi/sdk-shared';

export type TSpaceSetCdnCredentialMutation = Cdn;

const SpaceSetCdnCredentialMutation = gql`
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

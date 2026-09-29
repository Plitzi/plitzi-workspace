import { CDN_FIELDS } from '../../../fragments/cdnFields';

import type { Cdn } from '../../../../../../types';

export type TSpaceSetCdnCredentialMutation = Cdn;

const SpaceSetCdnCredentialMutation = /* GraphQL */ `
  mutation SpaceSetCdnCredentialMutation($identifier: String!, $credentialIdentifier: String!) {
    SpaceSetCdnCredential(identifier: $identifier, credentialIdentifier: $credentialIdentifier) {
      ${CDN_FIELDS}
    }
  }
`;

export default SpaceSetCdnCredentialMutation;

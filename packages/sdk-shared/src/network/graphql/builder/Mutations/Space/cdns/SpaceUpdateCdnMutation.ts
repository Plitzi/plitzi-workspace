import { CDN_FIELDS } from '../../../fragments/cdnFields';

import type { Cdn } from '../../../../../../types';

export type TSpaceUpdateCdnMutation = Cdn;

/** A CDN's account — name, provider, endpoint. Its buckets change one by one. */
const SpaceUpdateCdnMutation = /* GraphQL */ `
  mutation SpaceUpdateCdnMutation($identifier: String!, $name: String!, $provider: String!, $endpoint: String) {
    SpaceUpdateCdn(identifier: $identifier, name: $name, provider: $provider, endpoint: $endpoint) {
      ${CDN_FIELDS}
    }
  }
`;

export default SpaceUpdateCdnMutation;

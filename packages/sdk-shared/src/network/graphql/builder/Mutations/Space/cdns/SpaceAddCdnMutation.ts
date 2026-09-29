import { CDN_FIELDS } from '../../../fragments/cdnFields';

import type { Cdn } from '../../../../../../types';

export type TSpaceAddCdnMutation = Cdn;

/** A CDN — the customer's storage account — with its buckets, each with its own configuration. */
const SpaceAddCdnMutation = /* GraphQL */ `
  mutation SpaceAddCdnMutation($name: String!, $provider: String!, $endpoint: String, $buckets: [SpaceCdnBucketInput!]!) {
    SpaceAddCdn(name: $name, provider: $provider, endpoint: $endpoint, buckets: $buckets) {
      ${CDN_FIELDS}
    }
  }
`;

export default SpaceAddCdnMutation;

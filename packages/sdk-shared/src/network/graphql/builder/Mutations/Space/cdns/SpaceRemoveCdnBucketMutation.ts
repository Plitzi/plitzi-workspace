import { CDN_FIELDS } from '../../../fragments/cdnFields';

import type { Cdn } from '../../../../../../types';

export type TSpaceRemoveCdnBucketMutation = Cdn;

/** Takes a bucket off its CDN — its files stay in the provider's bucket; answers the CDN with the buckets left. */
const SpaceRemoveCdnBucketMutation = /* GraphQL */ `
  mutation SpaceRemoveCdnBucketMutation($cdnIdentifier: String!, $identifier: String!) {
    SpaceRemoveCdnBucket(cdnIdentifier: $cdnIdentifier, identifier: $identifier) {
      ${CDN_FIELDS}
    }
  }
`;

export default SpaceRemoveCdnBucketMutation;

import { CDN_FIELDS } from '../../../fragments/cdnFields';

import type { Cdn } from '../../../../../../types';

export type TSpaceUpdateCdnBucketMutation = Cdn;

/** Changes a bucket’s configuration; answers the CDN with all its buckets. */
const SpaceUpdateCdnBucketMutation = /* GraphQL */ `
  mutation SpaceUpdateCdnBucketMutation(
    $cdnIdentifier: String!
    $identifier: String!
    $name: String
    $bucketName: String!
    $region: String
    $visibility: String
    $domain: String
  ) {
    SpaceUpdateCdnBucket(
      cdnIdentifier: $cdnIdentifier
      identifier: $identifier
      name: $name
      bucketName: $bucketName
      region: $region
      visibility: $visibility
      domain: $domain
    ) {
      ${CDN_FIELDS}
    }
  }
`;

export default SpaceUpdateCdnBucketMutation;

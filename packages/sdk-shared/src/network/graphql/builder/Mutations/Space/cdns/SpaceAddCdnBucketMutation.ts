import { CDN_FIELDS } from '../../../fragments/cdnFields';

import type { Cdn } from '../../../../../../types';

export type TSpaceAddCdnBucketMutation = Cdn;

/** Adds a bucket to a CDN, with its own configuration; answers the CDN with all its buckets. */
const SpaceAddCdnBucketMutation = /* GraphQL */ `
  mutation SpaceAddCdnBucketMutation(
    $cdnIdentifier: String!
    $name: String
    $bucketName: String!
    $region: String
    $visibility: String
    $domain: String
  ) {
    SpaceAddCdnBucket(
      cdnIdentifier: $cdnIdentifier
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

export default SpaceAddCdnBucketMutation;

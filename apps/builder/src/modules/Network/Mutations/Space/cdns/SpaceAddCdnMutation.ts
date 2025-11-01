import { gql } from '@apollo/client/core';

import type { Cdn } from '@plitzi/sdk-shared';

export type TSpaceAddCdnMutation = Cdn;

const SpaceAddCdnMutation = gql`
  mutation SpaceAddCdnMutation(
    $name: String!
    $domain: String!
    $provider: String!
    $region: String!
    $endpoint: String
    $bucketName: String!
  ) {
    SpaceAddCdn(
      name: $name
      domain: $domain
      provider: $provider
      region: $region
      endpoint: $endpoint
      bucketName: $bucketName
    ) {
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

export default SpaceAddCdnMutation;

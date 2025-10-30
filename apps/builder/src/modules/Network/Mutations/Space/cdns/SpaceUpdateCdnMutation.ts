import { gql } from '@apollo/client/core';

const SpaceUpdateCdnMutation = gql`
  mutation SpaceUpdateCdnMutation(
    $identifier: String!
    $name: String!
    $domain: String!
    $provider: String!
    $region: String!
    $endpoint: String
    $bucketName: String!
  ) {
    SpaceUpdateCdn(
      identifier: $identifier
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
    }
  }
`;

export default SpaceUpdateCdnMutation;

import { gql } from '@apollo/client/core';

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
      id
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

export default SpaceAddCdnMutation;

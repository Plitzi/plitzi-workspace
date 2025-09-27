import { gql } from '@apollo/client/core';

const SpaceUpdateCdnMutation = gql`
  mutation SpaceUpdateCdnMutation(
    $id: Int!
    $name: String!
    $domain: String!
    $provider: String!
    $region: String!
    $endpoint: String
    $bucketName: String!
  ) {
    SpaceUpdateCdn(
      id: $id
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
    }
  }
`;

export default SpaceUpdateCdnMutation;

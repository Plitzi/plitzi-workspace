import type { Cdn } from '../../../../../../types';

export type TSpaceUpdateCdnMutation = Cdn;

const SpaceUpdateCdnMutation = /* GraphQL */ `
  mutation SpaceUpdateCdnMutation(
    $identifier: String!
    $name: String!
    $domain: String
    $visibility: String
    $provider: String!
    $region: String!
    $endpoint: String
    $bucketName: String!
  ) {
    SpaceUpdateCdn(
      identifier: $identifier
      name: $name
      domain: $domain
      visibility: $visibility
      provider: $provider
      region: $region
      endpoint: $endpoint
      bucketName: $bucketName
    ) {
      name
      identifier
      domain
      visibility
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

export default SpaceUpdateCdnMutation;

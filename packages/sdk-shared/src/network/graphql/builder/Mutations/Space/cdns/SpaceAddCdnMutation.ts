import type { Cdn } from '../../../../../../types';

export type TSpaceAddCdnMutation = Cdn;

const SpaceAddCdnMutation = /* GraphQL */ `
  mutation SpaceAddCdnMutation(
    $name: String!
    $domain: String
    $visibility: String
    $provider: String!
    $region: String!
    $endpoint: String
    $bucketName: String!
  ) {
    SpaceAddCdn(
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

export default SpaceAddCdnMutation;

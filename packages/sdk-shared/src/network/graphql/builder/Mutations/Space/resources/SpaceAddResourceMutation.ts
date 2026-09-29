import type { Resource } from '../../../../../../types';

export type TSpaceAddResourceMutation = Resource;

const SpaceAddResourceMutation = /* GraphQL */ `
  mutation SpaceAddResourceMutation(
    $cdnIdentifier: String!
    $bucketIdentifier: String!
    $resource: Upload!
    $type: String!
    $compression: String
    $prefix: String
  ) {
    SpaceAddResource(
      cdnIdentifier: $cdnIdentifier
      bucketIdentifier: $bucketIdentifier
      resource: $resource
      type: $type
      compression: $compression
      prefix: $prefix
    ) {
      id
      name
      path
      size
      type
    }
  }
`;

export default SpaceAddResourceMutation;

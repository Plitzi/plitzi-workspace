import { gql } from '@apollo/client/core';

import type { Resource } from '@plitzi/sdk-shared';

export type TSpaceAddResourceMutation = Resource;

const SpaceAddResourceMutation = gql`
  mutation SpaceAddResourceMutation(
    $cdnIdentifier: String!
    $resource: Upload!
    $type: String!
    $compression: String
    $prefix: String
  ) {
    SpaceAddResource(
      cdnIdentifier: $cdnIdentifier
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

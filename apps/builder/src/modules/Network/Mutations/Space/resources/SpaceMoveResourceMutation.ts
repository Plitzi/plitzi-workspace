import { gql } from '@apollo/client/core';

import type { Resource } from '@plitzi/sdk-shared';

export type TSpaceMoveResourceMutation = Resource;

const SpaceMoveResourceMutation = gql`
  mutation SpaceMoveResourceMutation($identifier: String!, $cdnIdentifier: String!, $prefix: String) {
    SpaceMoveResource(identifier: $identifier, cdnIdentifier: $cdnIdentifier, prefix: $prefix) {
      id
      name
      path
      size
      type
    }
  }
`;

export default SpaceMoveResourceMutation;

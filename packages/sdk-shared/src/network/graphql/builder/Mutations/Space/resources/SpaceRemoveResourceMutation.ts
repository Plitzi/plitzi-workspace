import { gql } from '@apollo/client/core';

import type { Resource } from '../../../../../../types';

export type TSpaceRemoveResourceMutation = Resource;

const SpaceRemoveResourceMutation = gql`
  mutation SpaceRemoveResourceMutation($identifier: String!, $cdnIdentifier: String!) {
    SpaceRemoveResource(identifier: $identifier, cdnIdentifier: $cdnIdentifier) {
      id
    }
  }
`;

export default SpaceRemoveResourceMutation;

import { gql } from '@apollo/client/core';

import type { SpaceAction } from '../../../../../../types';

export type TSpaceRemoveActionMutation = SpaceAction;

const SpaceRemoveActionMutation = gql`
  mutation SpaceRemoveActionMutation($identifier: String!) {
    SpaceRemoveAction(identifier: $identifier) {
      id
      identifier
      name
      enabled
      document
      createdAt
      updatedAt
    }
  }
`;

export default SpaceRemoveActionMutation;

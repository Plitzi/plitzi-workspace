import { gql } from '@apollo/client/core';

import type { SpaceAction } from '../../../../../../types';

export type TSpaceUpdateActionMutation = SpaceAction;

const SpaceUpdateActionMutation = gql`
  mutation SpaceUpdateActionMutation($identifier: String!, $name: String!, $document: Json!) {
    SpaceUpdateAction(identifier: $identifier, name: $name, document: $document) {
      id
      identifier
      name
      document
      createdAt
      updatedAt
    }
  }
`;

export default SpaceUpdateActionMutation;

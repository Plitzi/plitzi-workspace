import { gql } from '@apollo/client/core';

import type { SpaceAction } from '../../../../../../types';

export type TSpaceUpdateActionMutation = SpaceAction;

const SpaceUpdateActionMutation = gql`
  mutation SpaceUpdateActionMutation($identifier: String!, $name: String!, $document: Json!, $enabled: Boolean) {
    SpaceUpdateAction(identifier: $identifier, name: $name, document: $document, enabled: $enabled) {
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

export default SpaceUpdateActionMutation;

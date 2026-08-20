import { gql } from '@apollo/client/core';

import type { SpaceAction } from '../../../../../../types';

/**
 * The network layer unwraps a mutation's single root field, so this is the payload itself rather than the response
 * envelope — declaring the envelope compiles fine and then reads `undefined` at runtime.
 */
export type TSpaceAddActionMutation = SpaceAction;

const SpaceAddActionMutation = gql`
  mutation SpaceAddActionMutation($name: String!, $document: Json!) {
    SpaceAddAction(name: $name, document: $document) {
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

export default SpaceAddActionMutation;

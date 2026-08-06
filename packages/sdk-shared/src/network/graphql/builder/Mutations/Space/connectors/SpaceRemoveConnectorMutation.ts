import { gql } from '@apollo/client/core';

import type { SpaceConnector } from '../../../../../../types';

/**
 * The network layer unwraps a mutation's single root field, so this is the payload itself rather than the response
 * envelope — declaring the envelope compiles fine and then reads `undefined` at runtime.
 */
export type TSpaceRemoveConnectorMutation = Pick<SpaceConnector, 'id' | 'identifier'>;

const SpaceRemoveConnectorMutation = gql`
  mutation SpaceRemoveConnectorMutation($identifier: String!) {
    SpaceRemoveConnector(identifier: $identifier) {
      id
      identifier
    }
  }
`;

export default SpaceRemoveConnectorMutation;

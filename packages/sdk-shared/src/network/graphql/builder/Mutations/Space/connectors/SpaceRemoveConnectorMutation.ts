import { gql } from '@apollo/client/core';

import type { SpaceConnector } from '../../../../../../types';

export type TSpaceRemoveConnectorMutation = { SpaceRemoveConnector: SpaceConnector };

const SpaceRemoveConnectorMutation = gql`
  mutation SpaceRemoveConnectorMutation($identifier: String!) {
    SpaceRemoveConnector(identifier: $identifier) {
      id
      identifier
    }
  }
`;

export default SpaceRemoveConnectorMutation;

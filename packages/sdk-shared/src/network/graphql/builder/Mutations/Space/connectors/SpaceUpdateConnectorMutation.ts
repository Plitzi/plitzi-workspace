import { gql } from '@apollo/client/core';

import type { SpaceConnector } from '../../../../../../types';

export type TSpaceUpdateConnectorMutation = { SpaceUpdateConnector: SpaceConnector };

const SpaceUpdateConnectorMutation = gql`
  mutation SpaceUpdateConnectorMutation($identifier: String!, $name: String!, $manifest: JSON!) {
    SpaceUpdateConnector(identifier: $identifier, name: $name, manifest: $manifest) {
      id
      identifier
      name
      manifest
      createdAt
      updatedAt
    }
  }
`;

export default SpaceUpdateConnectorMutation;

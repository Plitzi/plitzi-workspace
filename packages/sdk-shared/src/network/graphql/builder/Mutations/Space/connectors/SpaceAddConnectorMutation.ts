import { gql } from '@apollo/client/core';

import type { SpaceConnector } from '../../../../../../types';

export type TSpaceAddConnectorMutation = { SpaceAddConnector: SpaceConnector };

const SpaceAddConnectorMutation = gql`
  mutation SpaceAddConnectorMutation($name: String!, $manifest: JSON!) {
    SpaceAddConnector(name: $name, manifest: $manifest) {
      id
      identifier
      name
      manifest
      createdAt
      updatedAt
    }
  }
`;

export default SpaceAddConnectorMutation;

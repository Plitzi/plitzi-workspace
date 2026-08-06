import { gql } from '@apollo/client/core';

import type { SpaceConnector } from '../../../../../../types';

/**
 * The network layer unwraps a mutation's single root field, so this is the payload itself rather than the response
 * envelope — declaring the envelope compiles fine and then reads `undefined` at runtime.
 */
export type TSpaceAddConnectorMutation = SpaceConnector;

const SpaceAddConnectorMutation = gql`
  mutation SpaceAddConnectorMutation($name: String!, $manifest: Json!) {
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

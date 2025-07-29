import { gql } from '@apollo/client/core';

const SpaceAddResourceMutation = gql`
  mutation SpaceAddResourceMutation($resource: Upload!, $type: String!, $compression: String) {
    SpaceAddResource(resource: $resource, type: $type, compression: $compression) {
      id
      name
      path
      size
      type
    }
  }
`;

export default SpaceAddResourceMutation;

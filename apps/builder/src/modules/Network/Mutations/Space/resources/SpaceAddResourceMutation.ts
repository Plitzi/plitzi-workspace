import { gql } from '@apollo/client/core';

const SpaceAddResourceMutation = gql`
  mutation SpaceAddResourceMutation($cdnIdentifier: String!, $resource: Upload!, $type: String!, $compression: String) {
    SpaceAddResource(cdnIdentifier: $cdnIdentifier, resource: $resource, type: $type, compression: $compression) {
      id
      name
      path
      size
      type
    }
  }
`;

export default SpaceAddResourceMutation;

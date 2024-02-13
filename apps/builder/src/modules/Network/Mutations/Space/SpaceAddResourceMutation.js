// Packages
import { gql } from '@apollo/client/core';

const SpaceAddResourceMutation = gql`
  mutation SpaceAddResourceMutation($resource: Upload!) {
    SpaceAddResource(resource: $resource) {
      id
      name
      path
      size
      type
    }
  }
`;

export default SpaceAddResourceMutation;

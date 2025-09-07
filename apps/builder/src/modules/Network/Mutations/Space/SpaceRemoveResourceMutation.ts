import { gql } from '@apollo/client/core';

const SpaceRemoveResourceMutation = gql`
  mutation SpaceRemoveResourceMutation($resourceId: String!) {
    SpaceRemoveResource(resourceId: $resourceId) {
      id
    }
  }
`;

export default SpaceRemoveResourceMutation;

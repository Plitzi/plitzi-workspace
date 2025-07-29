import { gql } from '@apollo/client/core';

const CollaboratorConnectedSubscription = gql`
  subscription {
    CollaboratorConnected {
      color
      instanceId
      user {
        id
        firstName
        surName
      }
    }
  }
`;

export default CollaboratorConnectedSubscription;

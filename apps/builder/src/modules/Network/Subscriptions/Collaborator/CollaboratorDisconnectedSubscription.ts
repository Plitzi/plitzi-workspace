import { gql } from '@apollo/client/core';

const CollaboratorDisconnectedSubscription = gql`
  subscription {
    CollaboratorDisconnected {
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

export default CollaboratorDisconnectedSubscription;

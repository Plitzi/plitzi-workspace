import { gql } from '@apollo/client/core';

export type TCollaboratorDisconnectedSubscription = {
  color: string;
  instanceId: string;
  user: { id: string; firstName: string; surName: string };
};

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

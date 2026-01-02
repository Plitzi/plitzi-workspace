import { gql } from '@apollo/client/core';

export type TCollaboratorConnectedSubscription = {
  color: string;
  instanceId: string;
  user: { id: string; firstName: string; surName: string };
};

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

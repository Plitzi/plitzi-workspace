import { gql } from '@apollo/client/core';

const SpaceRemoveCredentialMutation = gql`
  mutation SpaceRemoveCredentialMutation($identifier: String!) {
    SpaceRemoveCredential(identifier: $identifier) {
      identifier
    }
  }
`;

export default SpaceRemoveCredentialMutation;

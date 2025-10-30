import { gql } from '@apollo/client/core';

const SpaceUpdateCredentialMutation = gql`
  mutation SpaceUpdateCredentialMutation($identifier: String!, $name: String!, $provider: String!, $data: Json!) {
    SpaceUpdateCredential(identifier: $identifier, name: $name, provider: $provider, data: $data) {
      name
      identifier
      provider
    }
  }
`;

export default SpaceUpdateCredentialMutation;

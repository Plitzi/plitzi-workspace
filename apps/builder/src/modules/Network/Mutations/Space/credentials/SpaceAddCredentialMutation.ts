import { gql } from '@apollo/client/core';

const SpaceAddCredentialMutation = gql`
  mutation SpaceAddCredentialMutation($name: String!, $provider: String!, $data: Json!) {
    SpaceAddCredential(name: $name, provider: $provider, data: $data) {
      name
      identifier
      provider
    }
  }
`;

export default SpaceAddCredentialMutation;

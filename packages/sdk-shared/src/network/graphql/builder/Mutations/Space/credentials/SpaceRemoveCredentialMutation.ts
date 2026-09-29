import { gql } from 'graphql-tag';

const SpaceRemoveCredentialMutation = gql`
  mutation SpaceRemoveCredentialMutation($identifier: String!) {
    SpaceRemoveCredential(identifier: $identifier) {
      identifier
    }
  }
`;

export default SpaceRemoveCredentialMutation;

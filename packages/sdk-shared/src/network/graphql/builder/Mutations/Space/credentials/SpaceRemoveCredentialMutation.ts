const SpaceRemoveCredentialMutation = /* GraphQL */ `
  mutation SpaceRemoveCredentialMutation($identifier: String!) {
    SpaceRemoveCredential(identifier: $identifier) {
      identifier
    }
  }
`;

export default SpaceRemoveCredentialMutation;

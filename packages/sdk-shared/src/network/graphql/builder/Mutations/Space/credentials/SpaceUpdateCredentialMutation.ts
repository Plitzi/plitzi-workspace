const SpaceUpdateCredentialMutation = /* GraphQL */ `
  mutation SpaceUpdateCredentialMutation($identifier: String!, $name: String!, $provider: String!, $data: Json!) {
    SpaceUpdateCredential(identifier: $identifier, name: $name, provider: $provider, data: $data) {
      name
      identifier
      provider
      inUse
      usedIn {
        usedFrom
        name
      }
    }
  }
`;

export default SpaceUpdateCredentialMutation;

const SpaceAddVisitorMutation = /* GraphQL */ `
  mutation SpaceAddVisitorMutation($email: String!, $role: String!) {
    SpaceAddVisitor(email: $email, role: $role) {
      id
    }
  }
`;

export default SpaceAddVisitorMutation;

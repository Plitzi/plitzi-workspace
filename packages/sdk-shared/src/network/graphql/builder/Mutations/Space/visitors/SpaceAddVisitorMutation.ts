import { gql } from '@apollo/client/core';

const SpaceAddVisitorMutation = gql`
  mutation SpaceAddVisitorMutation($email: String!, $role: String!) {
    SpaceAddVisitor(email: $email, role: $role) {
      id
    }
  }
`;

export default SpaceAddVisitorMutation;

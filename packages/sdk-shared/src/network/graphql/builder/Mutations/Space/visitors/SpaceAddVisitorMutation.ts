import { gql } from 'graphql-tag';

const SpaceAddVisitorMutation = gql`
  mutation SpaceAddVisitorMutation($email: String!, $role: String!) {
    SpaceAddVisitor(email: $email, role: $role) {
      id
    }
  }
`;

export default SpaceAddVisitorMutation;

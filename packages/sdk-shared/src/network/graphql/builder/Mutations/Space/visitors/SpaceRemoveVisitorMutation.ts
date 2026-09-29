import { gql } from 'graphql-tag';

const SpaceRemoveVisitorMutation = gql`
  mutation SpaceRemoveVisitorMutation($id: Int!) {
    SpaceRemoveVisitor(id: $id) {
      id
    }
  }
`;

export default SpaceRemoveVisitorMutation;

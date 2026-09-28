import { gql } from '@apollo/client/core';

const SpaceRemoveVisitorMutation = gql`
  mutation SpaceRemoveVisitorMutation($id: Int!) {
    SpaceRemoveVisitor(id: $id) {
      id
    }
  }
`;

export default SpaceRemoveVisitorMutation;

import { gql } from '@apollo/client/core';

const SpaceRemoveCdnMutation = gql`
  mutation SpaceRemoveCdnMutation($id: String!) {
    SpaceRemoveCdn(id: $id) {
      id
    }
  }
`;

export default SpaceRemoveCdnMutation;

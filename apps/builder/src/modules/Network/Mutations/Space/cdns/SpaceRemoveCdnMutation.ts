import { gql } from '@apollo/client/core';

const SpaceRemoveCdnMutation = gql`
  mutation SpaceRemoveCdnMutation($identifier: String!) {
    SpaceRemoveCdn(identifier: $identifier) {
      id
      identifier
    }
  }
`;

export default SpaceRemoveCdnMutation;

import { gql } from '@apollo/client/core';

const SpaceRemoveCdnMutation = gql`
  mutation SpaceRemoveCdnMutation($identifier: String!) {
    SpaceRemoveCdn(identifier: $identifier) {
      identifier
    }
  }
`;

export default SpaceRemoveCdnMutation;

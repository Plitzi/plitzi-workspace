import { gql } from '@apollo/client/core';

const SpaceRemoveResourceMutation = gql`
  mutation SpaceRemoveResourceMutation($identifier: String!, $cdnIdentifier: String!) {
    SpaceRemoveResource(identifier: $identifier, cdnIdentifier: $cdnIdentifier) {
      id
    }
  }
`;

export default SpaceRemoveResourceMutation;

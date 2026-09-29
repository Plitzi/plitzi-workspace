import { gql } from '@apollo/client/core';

const SpaceRemoveRuntimeVariableMutation = gql`
  mutation SpaceRemoveRuntimeVariableMutation($name: String!) {
    SpaceRemoveRuntimeVariable(name: $name)
  }
`;

export default SpaceRemoveRuntimeVariableMutation;

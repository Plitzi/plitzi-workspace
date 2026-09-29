import { gql } from '@apollo/client/core';

const SpaceSetRuntimeVariableMutation = gql`
  mutation SpaceSetRuntimeVariableMutation($name: String!, $value: String!) {
    SpaceSetRuntimeVariable(name: $name, value: $value)
  }
`;

export default SpaceSetRuntimeVariableMutation;

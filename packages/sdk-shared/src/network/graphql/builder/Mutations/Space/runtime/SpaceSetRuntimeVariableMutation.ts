import { gql } from 'graphql-tag';

const SpaceSetRuntimeVariableMutation = gql`
  mutation SpaceSetRuntimeVariableMutation($name: String!, $value: String!) {
    SpaceSetRuntimeVariable(name: $name, value: $value)
  }
`;

export default SpaceSetRuntimeVariableMutation;

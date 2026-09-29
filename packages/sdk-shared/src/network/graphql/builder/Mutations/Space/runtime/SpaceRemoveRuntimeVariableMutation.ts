import { gql } from 'graphql-tag';

const SpaceRemoveRuntimeVariableMutation = gql`
  mutation SpaceRemoveRuntimeVariableMutation($name: String!) {
    SpaceRemoveRuntimeVariable(name: $name)
  }
`;

export default SpaceRemoveRuntimeVariableMutation;

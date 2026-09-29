import { gql } from 'graphql-tag';

const SpaceRemoveVariableMutation = gql`
  mutation SpaceRemoveVariableMutation($environment: String!, $name: String!) {
    SpaceRemoveVariable(environment: $environment, name: $name) {
      name
    }
  }
`;

export default SpaceRemoveVariableMutation;

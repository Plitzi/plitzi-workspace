import { gql } from '@apollo/client/core';

const SpaceStartRuntimeMutation = gql`
  mutation SpaceStartRuntimeMutation($environment: String!) {
    SpaceStartRuntime(environment: $environment)
  }
`;

export default SpaceStartRuntimeMutation;

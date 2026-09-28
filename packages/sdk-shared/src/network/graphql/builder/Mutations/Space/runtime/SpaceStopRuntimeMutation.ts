import { gql } from '@apollo/client/core';

const SpaceStopRuntimeMutation = gql`
  mutation SpaceStopRuntimeMutation($environment: String!) {
    SpaceStopRuntime(environment: $environment)
  }
`;

export default SpaceStopRuntimeMutation;

import { gql } from 'graphql-tag';

const SpaceStopRuntimeMutation = gql`
  mutation SpaceStopRuntimeMutation($environment: String!) {
    SpaceStopRuntime(environment: $environment)
  }
`;

export default SpaceStopRuntimeMutation;

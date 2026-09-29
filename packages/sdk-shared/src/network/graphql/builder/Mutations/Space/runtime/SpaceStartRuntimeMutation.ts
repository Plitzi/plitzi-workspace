import { gql } from 'graphql-tag';

const SpaceStartRuntimeMutation = gql`
  mutation SpaceStartRuntimeMutation($environment: String!) {
    SpaceStartRuntime(environment: $environment)
  }
`;

export default SpaceStartRuntimeMutation;

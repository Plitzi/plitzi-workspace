import { gql } from 'graphql-tag';

const SpaceSetRuntimeSizeMutation = gql`
  mutation SpaceSetRuntimeSizeMutation($environment: String!, $size: String!) {
    SpaceSetRuntimeSize(environment: $environment, size: $size)
  }
`;

export default SpaceSetRuntimeSizeMutation;

import { gql } from '@apollo/client/core';

const SpaceSetRuntimeSizeMutation = gql`
  mutation SpaceSetRuntimeSizeMutation($environment: String!, $size: String!) {
    SpaceSetRuntimeSize(environment: $environment, size: $size)
  }
`;

export default SpaceSetRuntimeSizeMutation;

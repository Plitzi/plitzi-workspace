// Packages
import { gql } from '@apollo/client/core';

const StyleUpdateMutation = gql`
  mutation StyleUpdate($environment: String!, $style: Json!) {
    StyleUpdate(environment: $environment, style: $style) {
      id
      platform
      cache
    }
  }
`;

export default StyleUpdateMutation;

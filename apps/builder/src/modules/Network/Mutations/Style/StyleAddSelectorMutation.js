// Packages
import { gql } from '@apollo/client/core';

const StyleAddSelectorMutation = gql`
  mutation StyleAddSelectorMutation(
    $environment: String!
    $displayMode: String!
    $selector: String!
    $type: String!
    $path: String
    $style: Json
  ) {
    StyleAddSelector(
      environment: $environment
      displayMode: $displayMode
      selector: $selector
      type: $type
      path: $path
      style: $style
    ) {
      id
      platform
      cache
    }
  }
`;

export default StyleAddSelectorMutation;

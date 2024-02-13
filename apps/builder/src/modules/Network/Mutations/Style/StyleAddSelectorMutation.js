// Packages
import { gql } from '@apollo/client/core';

const StyleAddSelectorMutation = gql`
  mutation StyleAddSelectorMutation(
    $environment: String!
    $displayMode: String!
    $selector: String!
    $path: String
    $style: Json
  ) {
    StyleAddSelector(
      environment: $environment
      displayMode: $displayMode
      selector: $selector
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

// Packages
import { gql } from '@apollo/client/core';

const SegmentStyleAddSelectorMutation = gql`
  mutation SegmentStyleAddSelectorMutation(
    $environment: String!
    $displayMode: String!
    $selector: String!
    $path: String
    $style: Json
    $contextId: String!
  ) {
    SegmentStyleAddSelector(
      environment: $environment
      displayMode: $displayMode
      selector: $selector
      path: $path
      style: $style
      contextId: $contextId
    ) {
      platform
      cache
    }
  }
`;

export default SegmentStyleAddSelectorMutation;

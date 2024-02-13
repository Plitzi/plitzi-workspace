// Packages
import { gql } from '@apollo/client/core';

const SegmentStyleUpdateSelectorMutation = gql`
  mutation SegmentStyleUpdateSelectorMutation(
    $environment: String!
    $displayMode: String!
    $selector: String!
    $path: String!
    $style: Json
    $contextId: String!
  ) {
    SegmentStyleUpdateSelector(
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

export default SegmentStyleUpdateSelectorMutation;

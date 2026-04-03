import { gql } from '@apollo/client/core';

const SegmentStyleUpdateSelectorMutation = gql`
  mutation SegmentStyleUpdateSelectorMutation(
    $environment: String!
    $displayMode: String!
    $selector: String!
    $path: String
    $style: Json
    $params: Json!
    $contextId: String!
  ) {
    SegmentStyleUpdateSelector(
      environment: $environment
      displayMode: $displayMode
      selector: $selector
      path: $path
      style: $style
      params: $params
      contextId: $contextId
    ) {
      variables
      platform
      cache
    }
  }
`;

export default SegmentStyleUpdateSelectorMutation;

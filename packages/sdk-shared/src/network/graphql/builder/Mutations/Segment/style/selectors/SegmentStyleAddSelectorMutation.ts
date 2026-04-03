import { gql } from '@apollo/client/core';

const SegmentStyleAddSelectorMutation = gql`
  mutation SegmentStyleAddSelectorMutation(
    $environment: String!
    $displayMode: String!
    $selector: String!
    $type: String!
    $path: String
    $style: Json
    $params: Json!
    $contextId: String!
  ) {
    SegmentStyleAddSelector(
      environment: $environment
      displayMode: $displayMode
      selector: $selector
      type: $type
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

export default SegmentStyleAddSelectorMutation;

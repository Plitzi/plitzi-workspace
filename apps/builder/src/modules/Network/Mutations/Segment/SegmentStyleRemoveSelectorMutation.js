// Packages
import { gql } from '@apollo/client/core';

const SegmentStyleRemoveSelectorMutation = gql`
  mutation SegmentStyleRemoveSelectorMutation($environment: String!, $selector: String!, $contextId: String!) {
    SegmentStyleRemoveSelector(environment: $environment, selector: $selector, contextId: $contextId) {
      platform
      cache
    }
  }
`;

export default SegmentStyleRemoveSelectorMutation;

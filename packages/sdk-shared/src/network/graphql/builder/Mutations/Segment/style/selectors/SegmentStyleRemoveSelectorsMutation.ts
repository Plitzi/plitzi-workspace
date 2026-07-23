import { gql } from '@apollo/client/core';

const SegmentStyleRemoveSelectorsMutation = gql`
  mutation SegmentStyleRemoveSelectorsMutation($environment: String!, $selectors: [String!]!, $contextId: String!) {
    SegmentStyleRemoveSelectors(environment: $environment, selectors: $selectors, contextId: $contextId) {
      displayMode
      selectors
    }
  }
`;

export default SegmentStyleRemoveSelectorsMutation;

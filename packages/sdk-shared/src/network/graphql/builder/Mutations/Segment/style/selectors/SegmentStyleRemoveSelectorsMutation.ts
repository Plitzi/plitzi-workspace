import { gql } from 'graphql-tag';

const SegmentStyleRemoveSelectorsMutation = gql`
  mutation SegmentStyleRemoveSelectorsMutation($environment: String!, $selectors: [String!]!, $contextId: String!) {
    SegmentStyleRemoveSelectors(environment: $environment, selectors: $selectors, contextId: $contextId) {
      displayMode
      selectors
    }
  }
`;

export default SegmentStyleRemoveSelectorsMutation;

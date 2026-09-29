import { gql } from 'graphql-tag';

const SegmentStyleRemoveSelectorMutation = gql`
  mutation SegmentStyleRemoveSelectorMutation($environment: String!, $selector: String!, $contextId: String!) {
    SegmentStyleRemoveSelector(environment: $environment, selector: $selector, contextId: $contextId) {
      displayMode
      selector
    }
  }
`;

export default SegmentStyleRemoveSelectorMutation;

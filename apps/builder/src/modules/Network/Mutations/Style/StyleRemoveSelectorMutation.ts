import { gql } from '@apollo/client/core';

const StyleRemoveSelectorMutation = gql`
  mutation StyleRemoveSelectorMutation($environment: String!, $displayMode: String, $selector: String!) {
    StyleRemoveSelector(environment: $environment, displayMode: $displayMode, selector: $selector) {
      id
      variables
      platform
      mode
      cache
    }
  }
`;

export default StyleRemoveSelectorMutation;

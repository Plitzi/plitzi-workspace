// Packages
import { gql } from '@apollo/client/core';

const StyleRemoveSelectorMutation = gql`
  mutation StyleRemoveSelectorMutation($environment: String!, $selector: String!) {
    StyleRemoveSelector(environment: $environment, selector: $selector) {
      id
      variables
      platform
      cache
    }
  }
`;

export default StyleRemoveSelectorMutation;

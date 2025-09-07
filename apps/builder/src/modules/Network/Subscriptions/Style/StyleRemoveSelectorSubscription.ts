import { gql } from '@apollo/client/core';

const StyleRemoveSelectorSubscription = gql`
  subscription ($environment: String!) {
    StyleRemoveSelector(environment: $environment) {
      selector
    }
  }
`;

export default StyleRemoveSelectorSubscription;

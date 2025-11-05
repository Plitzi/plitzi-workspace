import { gql } from '@apollo/client/core';

const StyleUpdateSettingsSubscription = gql`
  subscription ($environment: String!) {
    StyleUpdateSettings(environment: $environment) {
      value
      path
    }
  }
`;

export default StyleUpdateSettingsSubscription;

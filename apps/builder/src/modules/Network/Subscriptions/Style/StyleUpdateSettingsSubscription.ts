import { gql } from '@apollo/client/core';

export type TStyleUpdateSettingsSubscription = {
  path: string;
  value: string;
};

const StyleUpdateSettingsSubscription = gql`
  subscription ($environment: String!) {
    StyleUpdateSettings(environment: $environment) {
      path
      value
    }
  }
`;

export default StyleUpdateSettingsSubscription;

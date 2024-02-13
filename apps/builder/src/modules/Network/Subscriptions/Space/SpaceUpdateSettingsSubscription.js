// Packages
import { gql } from '@apollo/client/core';

const SpaceUpdateSettingsSubscription = gql`
  subscription ($environment: String!) {
    SpaceUpdateSettings(environment: $environment) {
      value
      path
    }
  }
`;

export default SpaceUpdateSettingsSubscription;

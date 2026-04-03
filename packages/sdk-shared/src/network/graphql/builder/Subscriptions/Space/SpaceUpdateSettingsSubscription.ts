import { gql } from '@apollo/client/core';

export type TSpaceUpdateSettingsSubscription = {
  path: string;
  value: number | string | boolean;
};

const SpaceUpdateSettingsSubscription = gql`
  subscription ($environment: String!) {
    SpaceUpdateSettings(environment: $environment) {
      value
      path
    }
  }
`;

export default SpaceUpdateSettingsSubscription;

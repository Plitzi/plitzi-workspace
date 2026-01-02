import { gql } from '@apollo/client/core';

import type { Style } from '@plitzi/sdk-shared';

export type TStyleUpdatedSubscription = Style;

const StyleUpdatedSubscription = gql`
  subscription ($environment: String!) {
    StyleUpdated(environment: $environment) {
      platform
      variables
      cache
    }
  }
`;

export default StyleUpdatedSubscription;

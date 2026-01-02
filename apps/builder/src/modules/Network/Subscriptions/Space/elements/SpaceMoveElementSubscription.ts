import { gql } from '@apollo/client/core';

import type { DropPosition } from '@plitzi/sdk-shared';

export type TSpaceMoveElementSubscription = {
  from: string;
  to: string;
  elementId: string;
  dropPosition: DropPosition;
};

const SpaceMoveElementSubscription = gql`
  subscription ($environment: String!) {
    SpaceMoveElement(environment: $environment) {
      elementId
      from
      to
      dropPosition
    }
  }
`;

export default SpaceMoveElementSubscription;

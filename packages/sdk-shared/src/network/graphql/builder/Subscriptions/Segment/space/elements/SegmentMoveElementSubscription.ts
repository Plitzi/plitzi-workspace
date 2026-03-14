import { gql } from '@apollo/client/core';

import type { DropPosition } from '../../../../../../../types';

export type TSegmentMoveElementSubscription = {
  contextId: string;
  elementId: string;
  from: string;
  to: string;
  dropPosition: DropPosition;
};

const SegmentMoveElementSubscription = gql`
  subscription ($environment: String!) {
    SegmentMoveElement(environment: $environment) {
      contextId
      elementId
      from
      to
      dropPosition
    }
  }
`;

export default SegmentMoveElementSubscription;

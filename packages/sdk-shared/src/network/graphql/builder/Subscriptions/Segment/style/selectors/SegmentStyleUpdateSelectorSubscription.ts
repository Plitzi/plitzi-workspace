import { gql } from '@apollo/client/core';

import type { DisplayMode, StyleItem, TagType } from '../../../../../../../types';

export type TSegmentStyleUpdateSelectorSubscription = {
  contextId: string;
  displayMode: DisplayMode;
  selector: string;
  type: TagType;
  path: string;
  style: StyleItem['attributes'];
};

const SegmentStyleUpdateSelectorSubscription = gql`
  subscription ($environment: String!) {
    SegmentStyleUpdateSelector(environment: $environment) {
      contextId
      displayMode
      selector
      type
      path
      style
    }
  }
`;

export default SegmentStyleUpdateSelectorSubscription;

import { gql } from '@apollo/client/core';

import type { DisplayMode, StyleItem, TagType } from '@plitzi/sdk-shared';

export type TSegmentStyleAddSelectorSubscription = {
  contextId: string;
  displayMode: DisplayMode;
  selector: string;
  type: TagType;
  path: string;
  style: StyleItem['attributes'];
};

const SegmentStyleAddSelectorSubscription = gql`
  subscription ($environment: String!) {
    SegmentStyleAddSelector(environment: $environment) {
      contextId
      displayMode
      selector
      type
      path
      style
    }
  }
`;

export default SegmentStyleAddSelectorSubscription;

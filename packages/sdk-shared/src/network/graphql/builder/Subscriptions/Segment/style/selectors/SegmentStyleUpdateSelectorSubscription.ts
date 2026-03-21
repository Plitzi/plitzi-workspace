import { gql } from '@apollo/client/core';

import type { DisplayMode, StyleCategory, StyleItem, TagType } from '../../../../../../../types';

export type TSegmentStyleUpdateSelectorSubscription = {
  contextId: string;
  displayMode: DisplayMode;
  selector: string;
  type: TagType;
  path?: StyleCategory;
  style?: StyleItem['attributes'];
  params: { componentType: string; styleSelector?: string };
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
      params
    }
  }
`;

export default SegmentStyleUpdateSelectorSubscription;

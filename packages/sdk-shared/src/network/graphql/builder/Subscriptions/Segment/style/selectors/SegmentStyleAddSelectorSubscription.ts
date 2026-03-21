import { gql } from '@apollo/client/core';

import type { DisplayMode, StyleCategory, StyleItem, TagType } from '../../../../../../../types';

export type TSegmentStyleAddSelectorSubscription = {
  contextId: string;
  displayMode: DisplayMode;
  selector: string;
  type: TagType;
  path?: StyleCategory;
  style?: StyleItem['attributes'];
  params: { componentType: string; styleSelector?: string };
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
      params
    }
  }
`;

export default SegmentStyleAddSelectorSubscription;

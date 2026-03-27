import { gql } from '@apollo/client/core';

import type { DisplayMode, StyleCategory, StyleItem, StyleState } from '../../../../../../../types';

export type TSegmentStyleUpdateSelectorSubscription = {
  contextId: string;
  displayMode: DisplayMode;
  selector: string;
  path?: StyleCategory;
  style?: StyleItem['attributes'];
  params: { componentType?: string; styleSelector: string; styleState?: StyleState; styleVariant?: string };
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

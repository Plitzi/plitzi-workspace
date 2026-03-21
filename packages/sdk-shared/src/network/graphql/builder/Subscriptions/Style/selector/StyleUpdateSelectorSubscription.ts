import { gql } from '@apollo/client/core';

import type { DisplayMode, StyleCategory, StyleItem, TagType } from '../../../../../../types';

export type TStyleUpdateSelectorSubscription = {
  displayMode: DisplayMode;
  selector: string;
  path?: StyleCategory;
  type: TagType;
  style?: StyleItem['attributes'];
  params: { componentType: string; styleSelector?: string };
};

const StyleUpdateSelectorSubscription = gql`
  subscription ($environment: String!) {
    StyleUpdateSelector(environment: $environment) {
      displayMode
      selector
      path
      type
      style
      params
    }
  }
`;

export default StyleUpdateSelectorSubscription;

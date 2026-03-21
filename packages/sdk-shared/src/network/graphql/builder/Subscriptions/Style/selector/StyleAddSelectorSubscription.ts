import { gql } from '@apollo/client/core';

import type { DisplayMode, StyleCategory, StyleItem, TagType } from '../../../../../../types';

export type TStyleAddSelectorSubscription = {
  displayMode: DisplayMode;
  selector: string;
  path?: StyleCategory;
  type: TagType;
  style?: StyleItem['attributes'];
  params: { componentType: string; styleSelector?: string };
};

const StyleAddSelectorSubscription = gql`
  subscription ($environment: String!) {
    StyleAddSelector(environment: $environment) {
      displayMode
      selector
      path
      type
      style
      params
    }
  }
`;

export default StyleAddSelectorSubscription;

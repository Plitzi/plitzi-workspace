import { gql } from '@apollo/client/core';

import type { DisplayMode, StyleItem, TagType } from '../../../../../../types';

export type TStyleAddSelectorSubscription = {
  displayMode: DisplayMode;
  selector: string;
  path: string;
  type: TagType;
  style: StyleItem['attributes'];
};

const StyleAddSelectorSubscription = gql`
  subscription ($environment: String!) {
    StyleAddSelector(environment: $environment) {
      displayMode
      selector
      path
      type
      style
    }
  }
`;

export default StyleAddSelectorSubscription;

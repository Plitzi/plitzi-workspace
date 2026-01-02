import { gql } from '@apollo/client/core';

import type { DisplayMode, StyleItem, TagType } from '@plitzi/sdk-shared';

export type TStyleUpdateSelectorSubscription = {
  displayMode: DisplayMode;
  selector: string;
  path: string;
  type: TagType;
  style: StyleItem['attributes'];
};

const StyleUpdateSelectorSubscription = gql`
  subscription ($environment: String!) {
    StyleUpdateSelector(environment: $environment) {
      displayMode
      selector
      path
      type
      style
    }
  }
`;

export default StyleUpdateSelectorSubscription;

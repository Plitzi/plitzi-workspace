import { gql } from '@apollo/client/core';

import type { DisplayMode, StyleCategory, StyleItem, StyleState } from '../../../../../../types';

export type TStyleUpdateSelectorSubscription = {
  displayMode: DisplayMode;
  selector: string;
  path?: StyleCategory;
  style?: StyleItem['attributes'];
  params: { componentType?: string; styleSelector: string; styleState?: StyleState; styleVariant?: string };
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

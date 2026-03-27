import { gql } from '@apollo/client/core';

import type { DisplayMode, StyleCategory, StyleItem, StyleState, TagType } from '../../../../../../types';

export type TStyleAddSelectorSubscription = {
  displayMode: DisplayMode;
  selector: string;
  path?: StyleCategory;
  type: TagType;
  style?: StyleItem['attributes'];
  params: { componentType: string; styleSelector?: string; styleState?: StyleState; styleVariant?: string };
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

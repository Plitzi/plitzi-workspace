import { gql } from '@apollo/client/core';

import type { DisplayMode, StyleItem, TagType } from '../../../../../../types';

export type TStyleUpdateSelectorSubscription =
  | {
      displayMode: DisplayMode;
      selector: string;
      path: string;
      type: Exclude<TagType, 'class-component'>;
      style: Exclude<StyleItem, { type: 'class-component' }>['attributes'];
    }
  | {
      displayMode: DisplayMode;
      selector: string;
      path: string;
      type: 'class-component';
      style: Extract<StyleItem, { type: 'class-component' }>['attributes'];
      params: { componentType: string };
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

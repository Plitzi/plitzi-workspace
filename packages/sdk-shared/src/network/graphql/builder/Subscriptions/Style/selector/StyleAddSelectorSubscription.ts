import { gql } from '@apollo/client/core';

import type { DisplayMode, StyleItem, TagType } from '../../../../../../types';

export type TStyleAddSelectorSubscription =
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

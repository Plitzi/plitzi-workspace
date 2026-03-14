import { gql } from '@apollo/client/core';

import type { DropPosition, Element, SchemaVariable, Style } from '../../../../../types';

export type TSpaceAddTemplateSubscription = {
  element: Element;
  style: Style;
  to: string;
  dropPosition: DropPosition;
  initialItems?: Element[];
  variables?: SchemaVariable[];
};

const SpaceAddTemplateSubscription = gql`
  subscription ($environment: String!) {
    SpaceAddTemplate(environment: $environment) {
      element {
        id
        definition {
          label
          type
          initialState
          styleSelectors
          bindings
          interactions
          parentId
          rootId
          items
        }
        attributes
      }
      styles
      dropPosition
      to
      initialItems
      variables {
        name
        category
        type
        value
        subValues {
          value
          when
        }
      }
    }
  }
`;

export default SpaceAddTemplateSubscription;

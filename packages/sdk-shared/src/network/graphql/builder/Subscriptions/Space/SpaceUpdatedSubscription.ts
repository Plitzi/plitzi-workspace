import { gql } from '@apollo/client/core';

import type { SchemaRaw } from '../../../../../types';

export type TSpaceUpdatedSubscription = { schema: SchemaRaw };

const SpaceUpdatedSubscription = gql`
  subscription ($environment: String!) {
    SpaceUpdated(environment: $environment) {
      schema {
        flat {
          id
          idRef
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
        pages
      }
    }
  }
`;

export default SpaceUpdatedSubscription;

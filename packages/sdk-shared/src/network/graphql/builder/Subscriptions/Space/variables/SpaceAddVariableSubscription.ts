import { gql } from '@apollo/client/core';

import type { SchemaVariable } from '../../../../../../types';

export type TSpaceAddVariableSubscription = {
  variable: SchemaVariable;
};

const SpaceAddVariableSubscription = gql`
  subscription ($environment: String!) {
    SpaceAddVariable(environment: $environment) {
      variable {
        name
        category
        type
        value
        subValues {
          when
          value
        }
      }
    }
  }
`;

export default SpaceAddVariableSubscription;

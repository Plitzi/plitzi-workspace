import { gql } from '@apollo/client/core';

import type { SchemaVariable } from '../../../../../../types';

export type TSpaceUpdateVariableSubscription = {
  variable: SchemaVariable;
};

const SpaceUpdateVariableSubscription = gql`
  subscription ($environment: String!) {
    SpaceUpdateVariable(environment: $environment) {
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

export default SpaceUpdateVariableSubscription;

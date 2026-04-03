import { gql } from '@apollo/client/core';

import type { StyleVariableCategory, StyleVariableValue } from '../../../../../../types';

export type TStyleUpdateVariableSubscription = {
  category: StyleVariableCategory;
  name: string;
  value: StyleVariableValue;
};

const StyleUpdateVariableSubscription = gql`
  subscription ($environment: String!) {
    StyleUpdateVariable(environment: $environment) {
      category
      name
      value
    }
  }
`;

export default StyleUpdateVariableSubscription;

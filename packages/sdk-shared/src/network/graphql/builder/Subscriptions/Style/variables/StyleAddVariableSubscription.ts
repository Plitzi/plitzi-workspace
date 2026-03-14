import { gql } from '@apollo/client/core';

import type { StyleVariableCategory, StyleVariableValue } from '../../../../../../types';

export type TStyleAddVariableSubscription = {
  category: StyleVariableCategory;
  name: string;
  value: StyleVariableValue;
};

const StyleAddVariableSubscription = gql`
  subscription ($environment: String!) {
    StyleAddVariable(environment: $environment) {
      category
      name
      value
    }
  }
`;

export default StyleAddVariableSubscription;

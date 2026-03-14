import { gql } from '@apollo/client/core';

import type { StyleVariableCategory } from '../../../../../../types';

export type TStyleRemoveVariableSubscription = {
  category: StyleVariableCategory;
  name: string;
};

const StyleRemoveVariableSubscription = gql`
  subscription ($environment: String!) {
    StyleRemoveVariable(environment: $environment) {
      category
      name
    }
  }
`;

export default StyleRemoveVariableSubscription;

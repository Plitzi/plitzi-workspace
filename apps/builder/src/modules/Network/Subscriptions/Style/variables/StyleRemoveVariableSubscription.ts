import { gql } from '@apollo/client/core';

import type { StyleVariableCategory } from '@plitzi/sdk-shared';

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

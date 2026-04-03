import { gql } from '@apollo/client/core';

export type TSpaceRemoveVariableSubscription = {
  name: string;
};

const SpaceRemoveVariableSubscription = gql`
  subscription ($environment: String!) {
    SpaceRemoveVariable(environment: $environment) {
      name
    }
  }
`;

export default SpaceRemoveVariableSubscription;

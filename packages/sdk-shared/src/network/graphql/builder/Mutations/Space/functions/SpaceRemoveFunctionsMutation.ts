import { gql } from '@apollo/client/core';

export type TSpaceRemoveFunctionsMutation = boolean;

const SpaceRemoveFunctionsMutation = gql`
  mutation SpaceRemoveFunctionsMutation {
    SpaceRemoveFunctions
  }
`;

export default SpaceRemoveFunctionsMutation;

import { gql } from 'graphql-tag';

export type TSpaceRemoveFunctionsMutation = boolean;

const SpaceRemoveFunctionsMutation = gql`
  mutation SpaceRemoveFunctionsMutation {
    SpaceRemoveFunctions
  }
`;

export default SpaceRemoveFunctionsMutation;

import type { SpaceAction } from '../../../../../../types';

export type TSpaceRemoveActionMutation = SpaceAction;

const SpaceRemoveActionMutation = /* GraphQL */ `
  mutation SpaceRemoveActionMutation($identifier: String!) {
    SpaceRemoveAction(identifier: $identifier) {
      id
      identifier
      name
      document
      createdAt
      updatedAt
    }
  }
`;

export default SpaceRemoveActionMutation;

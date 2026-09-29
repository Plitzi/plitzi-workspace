import type { SpaceAction } from '../../../../../../types';

export type TSpaceUpdateActionMutation = SpaceAction;

const SpaceUpdateActionMutation = /* GraphQL */ `
  mutation SpaceUpdateActionMutation($identifier: String!, $name: String!, $document: Json!) {
    SpaceUpdateAction(identifier: $identifier, name: $name, document: $document) {
      id
      identifier
      name
      document
      createdAt
      updatedAt
    }
  }
`;

export default SpaceUpdateActionMutation;

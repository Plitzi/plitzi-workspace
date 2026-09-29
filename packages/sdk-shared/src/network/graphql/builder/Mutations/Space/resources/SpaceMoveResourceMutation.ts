import type { Resource } from '../../../../../../types';

export type TSpaceMoveResourceMutation = Resource;

const SpaceMoveResourceMutation = /* GraphQL */ `
  mutation SpaceMoveResourceMutation($identifier: String!, $cdnIdentifier: String!, $prefix: String!) {
    SpaceMoveResource(identifier: $identifier, cdnIdentifier: $cdnIdentifier, prefix: $prefix) {
      id
      name
      path
      size
      type
    }
  }
`;

export default SpaceMoveResourceMutation;

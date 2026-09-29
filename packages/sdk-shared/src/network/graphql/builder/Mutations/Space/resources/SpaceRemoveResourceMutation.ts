import type { Resource } from '../../../../../../types';

export type TSpaceRemoveResourceMutation = Resource;

const SpaceRemoveResourceMutation = /* GraphQL */ `
  mutation SpaceRemoveResourceMutation($identifier: String!, $cdnIdentifier: String!, $bucketIdentifier: String!) {
    SpaceRemoveResource(identifier: $identifier, cdnIdentifier: $cdnIdentifier, bucketIdentifier: $bucketIdentifier) {
      id
    }
  }
`;

export default SpaceRemoveResourceMutation;

import type { Cdn } from '../../../../../../types';

export type TSpaceRemoveCdnMutation = Cdn;

const SpaceRemoveCdnMutation = /* GraphQL */ `
  mutation SpaceRemoveCdnMutation($identifier: String!) {
    SpaceRemoveCdn(identifier: $identifier) {
      identifier
    }
  }
`;

export default SpaceRemoveCdnMutation;

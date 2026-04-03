import { gql } from '@apollo/client/core';

import type { Cdn } from '../../../../../../types';

export type TSpaceRemoveCdnMutation = Cdn;

const SpaceRemoveCdnMutation = gql`
  mutation SpaceRemoveCdnMutation($identifier: String!) {
    SpaceRemoveCdn(identifier: $identifier) {
      identifier
    }
  }
`;

export default SpaceRemoveCdnMutation;

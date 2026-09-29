import { gql } from 'graphql-tag';

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

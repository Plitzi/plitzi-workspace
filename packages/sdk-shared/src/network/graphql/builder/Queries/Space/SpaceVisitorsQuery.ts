import { gql } from '@apollo/client/core';

import type { SpaceVisitor } from '../../../../../types';

export type TSpaceVisitorsQuery = { SpaceVisitors: SpaceVisitor[] };

const SpaceVisitorsQuery = gql`
  query SpaceVisitorsQuery {
    SpaceVisitors {
      id
      email
      role
      claimed
      createdAt
      updatedAt
    }
  }
`;

export default SpaceVisitorsQuery;

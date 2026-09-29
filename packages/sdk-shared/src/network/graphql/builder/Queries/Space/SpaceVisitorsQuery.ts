import type { SpaceVisitor } from '../../../../../types';

export type TSpaceVisitorsQuery = { SpaceVisitors: SpaceVisitor[] };

const SpaceVisitorsQuery = /* GraphQL */ `
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

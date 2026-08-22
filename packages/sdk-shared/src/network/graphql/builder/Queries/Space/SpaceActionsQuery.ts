import { gql } from '@apollo/client/core';

import type { SpaceAction, PageInfo } from '../../../../../types';

export type TSpaceActionsQuery = {
  SpaceActions: { edges: SpaceAction[]; pageInfo: PageInfo };
};

const SpaceActionsQuery = gql`
  query SpaceActionsQuery($filter: ActionInput, $page: Int, $pageSize: Int, $offset: Int) {
    SpaceActions(filter: $filter, page: $page, pageSize: $pageSize, offset: $offset) {
      edges {
        id
        identifier
        name
        document
        createdAt
        updatedAt
      }
      pageInfo {
        hasPrevPage
        hasNextPage
        from
        to
        total
      }
    }
  }
`;

export default SpaceActionsQuery;

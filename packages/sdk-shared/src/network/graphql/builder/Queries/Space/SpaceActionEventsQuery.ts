import type { ActionEvent, PageInfo } from '../../../../../types';

export type TSpaceActionEventsQuery = {
  SpaceActionEvents: { edges: ActionEvent[]; pageInfo: PageInfo };
};

const SpaceActionEventsQuery = /* GraphQL */ `
  query SpaceActionEventsQuery($actionId: String, $page: Int, $pageSize: Int) {
    SpaceActionEvents(actionId: $actionId, page: $page, pageSize: $pageSize) {
      edges {
        id
        actionId
        runId
        trigger
        status
        refused
        reason
        durationMs
        steps
        detail
        createdAt
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

export default SpaceActionEventsQuery;

import { gql } from '@apollo/client/core';

import type { SpaceConnector, PageInfo } from '../../../../../types';

export type TSpaceConnectorsQuery = {
  SpaceConnectors: { edges: SpaceConnector[]; pageInfo: PageInfo };
};

const SpaceConnectorsQuery = gql`
  query SpaceConnectorsQuery($filter: ConnectorInput, $page: Int, $pageSize: Int, $offset: Int) {
    SpaceConnectors(filter: $filter, page: $page, pageSize: $pageSize, offset: $offset) {
      edges {
        id
        identifier
        name
        manifest
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

export default SpaceConnectorsQuery;

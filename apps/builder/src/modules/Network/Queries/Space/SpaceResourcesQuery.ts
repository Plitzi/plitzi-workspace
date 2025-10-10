import { gql } from '@apollo/client/core';

import type { Resource } from '@pmodules/Resources/types';

export type TSpaceResourcesQuery = {
  SpaceResources: { resources: Resource[] };
};

const SpaceResourcesQuery = gql`
  query SpaceResourcesQuery($cdnIdentifier: String!, $filter: ResourceInput, $page: Int, $pageSize: Int, $offset: Int) {
    SpaceResources(cdnIdentifier: $cdnIdentifier, filter: $filter, page: $page, pageSize: $pageSize, offset: $offset) {
      resources {
        id
        cdnIdentifier
        name
        type
        size
        path
        createdAt
        updatedAt
      }
    }
  }
`;

export default SpaceResourcesQuery;

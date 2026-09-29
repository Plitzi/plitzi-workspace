import type { Resource } from '../../../../../types';

export type TSpaceResourcesQuery = {
  SpaceResources: { resources: Resource[] };
};

const SpaceResourcesQuery = /* GraphQL */ `
  query SpaceResourcesQuery(
    $cdnIdentifier: String!
    $bucketIdentifier: String!
    $filter: ResourceInput
    $page: Int
    $pageSize: Int
    $offset: Int
  ) {
    SpaceResources(
      cdnIdentifier: $cdnIdentifier
      bucketIdentifier: $bucketIdentifier
      filter: $filter
      page: $page
      pageSize: $pageSize
      offset: $offset
    ) {
      resources {
        id
        cdnIdentifier
        bucketIdentifier
        name
        type
        size
        path
        usedBy
        createdAt
        updatedAt
      }
    }
  }
`;

export default SpaceResourcesQuery;

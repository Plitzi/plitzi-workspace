import { gql } from '@apollo/client/core';

import type { PageInfo } from '@plitzi/sdk-shared';

export type Domain = {
  default: boolean;
  domain: string;
  environment: 'main' | 'production' | 'staging' | 'development';
  id: string;
  isVerified: boolean;
  revision: number | null;
};

export type TSpaceDeploymentsQuery = {
  SpaceDeployments: { edges: Domain[]; pageInfo: PageInfo };
};

const SpaceDeploymentsQuery = gql`
  query SpaceDeploymentsQuery($filter: DeploymentInput, $page: Int, $pageSize: Int, $offset: Int) {
    SpaceDeployments(filter: $filter, page: $page, pageSize: $pageSize, offset: $offset) {
      edges {
        id
        environment
        revision
        domain
        isVerified
        default
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

export default SpaceDeploymentsQuery;

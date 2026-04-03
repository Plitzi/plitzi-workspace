import { gql } from '@apollo/client/core';

import type { PageInfo, SpaceDeployment } from '../../../../../types';

export type TSpaceDeploymentsQuery = {
  SpaceDeployments: { edges: SpaceDeployment[]; pageInfo: PageInfo };
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
        credential {
          identifier
        }
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

import { gql } from '@apollo/client/core';

import type { Credential, PageInfo } from '@plitzi/sdk-shared';

export type TSpaceCredentialsQuery = {
  SpaceCredentials: { edges: Credential[]; pageInfo: PageInfo };
};

const SpaceCredentialsQuery = gql`
  query SpaceCredentialsQuery($filter: CredentialInput, $page: Int, $pageSize: Int, $offset: Int) {
    SpaceCredentials(filter: $filter, page: $page, pageSize: $pageSize, offset: $offset) {
      edges {
        identifier
        name
        provider
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

export default SpaceCredentialsQuery;

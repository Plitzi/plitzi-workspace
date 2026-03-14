import { gql } from '@apollo/client/core';

import type { SpaceCredential, PageInfo } from '../../../../../types';

export type TSpaceCredentialsQuery = {
  SpaceCredentials: { edges: SpaceCredential[]; pageInfo: PageInfo };
};

const SpaceCredentialsQuery = gql`
  query SpaceCredentialsQuery($filter: CredentialInput, $page: Int, $pageSize: Int, $offset: Int) {
    SpaceCredentials(filter: $filter, page: $page, pageSize: $pageSize, offset: $offset) {
      edges {
        identifier
        name
        provider
        inUse
        usedIn {
          usedFrom
          name
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

export default SpaceCredentialsQuery;

// Packages
import { gql } from '@apollo/client/core';

const PluginsQuery = gql`
  query PluginsQuery($filter: PluginInput, $page: Int, $pageSize: Int, $offset: Int) {
    Plugins(filter: $filter, page: $page, pageSize: $pageSize, offset: $offset) {
      edges {
        name
        description
        type
        latestVersion {
          version
          createdAt
          updatedAt
        }
        market {
          backgroundColor
          icon
          verified
          website
          owner
          license
          category {
            name
          }
        }
        revisions {
          version
          scope
          module
          manifestUrl
          assets {
            type
            url
            sizeNormal
            sizeGzip
          }
          createdAt
          updatedAt
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

export default PluginsQuery;

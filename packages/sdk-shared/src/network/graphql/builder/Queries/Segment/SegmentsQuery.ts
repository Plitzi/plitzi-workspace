import { gql } from '@apollo/client/core';

import type { PageInfo, SegmentRaw } from '../../../../../types';

export type TSegmentsQuery = {
  Segments: { edges: SegmentRaw[]; pageInfo: PageInfo };
};

const SegmentsQuery = gql`
  query SegmentsQuery($environment: String!, $filter: JsonObject, $cursor: String, $limit: Int) {
    Segments(environment: $environment, filter: $filter, cursor: $cursor, limit: $limit) {
      edges {
        id
        identifier
        definition
        schema {
          variables {
            name
            category
            type
            value
            subValues {
              value
              when
            }
          }
          flat {
            id
            idRef
            definition {
              label
              type
              initialState
              styleSelectors
              bindings
              interactions
              parentId
              rootId
              items
            }
            attributes
          }
        }
        style {
          variables
          platform
          cache
        }
        createdAt
        updatedAt
      }
      pageInfo {
        hasPrevPage
        hasNextPage
        prevCursor
        nextCursor
        from
        to
        total
      }
    }
  }
`;

export default SegmentsQuery;

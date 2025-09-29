import { gql } from '@apollo/client/core';

import type { SegmentRaw } from '@plitzi/sdk-shared';

export type TSegmentQuery = {
  Segment: SegmentRaw;
};

const SegmentQuery = gql`
  query SegmentQuery($id: String, $identifier: String, $environment: String!) {
    Segment(id: $id, identifier: $identifier, environment: $environment) {
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
  }
`;

export default SegmentQuery;

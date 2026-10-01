import type { SegmentRaw } from '../../../../../types';

export type TSegmentQuery = {
  Segment: SegmentRaw;
};

const SegmentQuery = /* GraphQL */ `
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
            runtime
            loadStrategy
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

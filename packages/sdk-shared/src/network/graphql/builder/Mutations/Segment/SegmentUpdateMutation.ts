import type { SegmentRaw } from '../../../../../types';

export type TSegmentUpdateMutation = SegmentRaw;

const SegmentUpdateMutation = /* GraphQL */ `
  mutation SegmentUpdateMutation($id: String!, $segment: Json!) {
    SegmentUpdate(id: $id, segment: $segment) {
      id
      identifier
      definition
      schema {
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
    }
  }
`;

export default SegmentUpdateMutation;

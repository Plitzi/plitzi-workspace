import { gql } from '@apollo/client/core';

const SegmentRemoveMutation = gql`
  mutation SegmentRemoveMutation($id: String!) {
    SegmentRemove(id: $id) {
      id
      identifier
    }
  }
`;

export default SegmentRemoveMutation;

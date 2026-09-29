import { gql } from 'graphql-tag';

const SegmentRemoveMutation = gql`
  mutation SegmentRemoveMutation($id: String!) {
    SegmentRemove(id: $id) {
      id
      identifier
    }
  }
`;

export default SegmentRemoveMutation;

const SegmentRemoveMutation = /* GraphQL */ `
  mutation SegmentRemoveMutation($id: String!) {
    SegmentRemove(id: $id) {
      id
      identifier
    }
  }
`;

export default SegmentRemoveMutation;

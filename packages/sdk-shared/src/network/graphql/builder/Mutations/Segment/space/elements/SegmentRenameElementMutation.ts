export type TSegmentRenameElementMutation = string[];

const SegmentRenameElementMutation = /* GraphQL */ `
  mutation SegmentRenameElementMutation($environment: String!, $elementId: String!, $id: String!, $contextId: String!) {
    SegmentRenameElement(environment: $environment, elementId: $elementId, id: $id, contextId: $contextId)
  }
`;

export default SegmentRenameElementMutation;

import { gql } from '@apollo/client/core';

export type TSegmentRenameElementMutation = string[];

const SegmentRenameElementMutation = gql`
  mutation SegmentRenameElementMutation($environment: String!, $elementId: String!, $id: String!, $contextId: String!) {
    SegmentRenameElement(environment: $environment, elementId: $elementId, id: $id, contextId: $contextId)
  }
`;

export default SegmentRenameElementMutation;

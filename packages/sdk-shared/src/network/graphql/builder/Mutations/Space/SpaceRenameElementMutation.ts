import { gql } from '@apollo/client/core';

/** The ids, under their new names, of every element the rename touched — the one renamed plus everything repointed
 *  onto it. */
export type TSpaceRenameElementMutation = string[];

const SpaceRenameElementMutation = gql`
  mutation SpaceRenameElementMutation($environment: String!, $elementId: String!, $id: String!) {
    SpaceRenameElement(environment: $environment, elementId: $elementId, id: $id)
  }
`;

export default SpaceRenameElementMutation;

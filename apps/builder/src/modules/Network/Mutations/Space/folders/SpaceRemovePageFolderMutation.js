// Packages
import { gql } from '@apollo/client/core';

const SpaceRemovePageFolderMutation = gql`
  mutation SpaceRemovePageFolderMutation($environment: String!, $pageFolderId: String!) {
    SpaceRemovePageFolder(environment: $environment, pageFolderId: $pageFolderId) {
      id
    }
  }
`;

export default SpaceRemovePageFolderMutation;

import { gql } from '@apollo/client/core';

import type { PageFolder } from '@plitzi/sdk-shared';

export type TSpaceRemovePageFolderMutation = PageFolder;

const SpaceRemovePageFolderMutation = gql`
  mutation SpaceRemovePageFolderMutation($environment: String!, $pageFolderId: String!) {
    SpaceRemovePageFolder(environment: $environment, pageFolderId: $pageFolderId) {
      id
    }
  }
`;

export default SpaceRemovePageFolderMutation;

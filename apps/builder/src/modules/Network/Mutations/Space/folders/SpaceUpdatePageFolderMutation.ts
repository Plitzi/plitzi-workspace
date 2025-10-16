import { gql } from '@apollo/client/core';

import type { PageFolder } from '@plitzi/sdk-shared';

export type TSpaceUpdatePageFolderMutation = PageFolder;

const SpaceUpdatePageFolderMutation = gql`
  mutation SpaceUpdatePageFolderMutation($environment: String!, $pageFolder: Json!) {
    SpaceUpdatePageFolder(environment: $environment, pageFolder: $pageFolder) {
      id
      name
      slug
      parentId
    }
  }
`;

export default SpaceUpdatePageFolderMutation;

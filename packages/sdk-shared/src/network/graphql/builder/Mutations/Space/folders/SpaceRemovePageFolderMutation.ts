import type { PageFolder } from '../../../../../../types';

export type TSpaceRemovePageFolderMutation = PageFolder;

const SpaceRemovePageFolderMutation = /* GraphQL */ `
  mutation SpaceRemovePageFolderMutation($environment: String!, $pageFolderId: String!) {
    SpaceRemovePageFolder(environment: $environment, pageFolderId: $pageFolderId) {
      id
    }
  }
`;

export default SpaceRemovePageFolderMutation;

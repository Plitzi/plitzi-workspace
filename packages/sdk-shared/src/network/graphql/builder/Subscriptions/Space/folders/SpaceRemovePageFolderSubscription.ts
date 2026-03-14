import { gql } from '@apollo/client/core';

export type TSpaceRemovePageFolderSubscription = {
  pageFolderId: string;
};

const SpaceRemovePageFolderSubscription = gql`
  subscription ($environment: String!) {
    SpaceRemovePageFolder(environment: $environment) {
      pageFolderId
    }
  }
`;

export default SpaceRemovePageFolderSubscription;

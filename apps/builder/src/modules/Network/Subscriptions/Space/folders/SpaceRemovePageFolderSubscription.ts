import { gql } from '@apollo/client/core';

const SpaceRemovePageFolderSubscription = gql`
  subscription ($environment: String!) {
    SpaceRemovePageFolder(environment: $environment) {
      pageFolderId
    }
  }
`;

export default SpaceRemovePageFolderSubscription;

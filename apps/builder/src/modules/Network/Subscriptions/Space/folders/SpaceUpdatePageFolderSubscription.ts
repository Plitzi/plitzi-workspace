import { gql } from '@apollo/client/core';

import type { PageFolder } from '@plitzi/sdk-shared';

export type TSpaceUpdatePageFolderSubscription = {
  pageFolder: PageFolder;
};

const SpaceUpdatePageFolderSubscription = gql`
  subscription ($environment: String!) {
    SpaceUpdatePageFolder(environment: $environment) {
      pageFolder {
        id
        name
        slug
        parentId
      }
    }
  }
`;

export default SpaceUpdatePageFolderSubscription;

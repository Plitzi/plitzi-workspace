import { gql } from '@apollo/client/core';

import type { PageFolder } from '@plitzi/sdk-shared';

export type TSpaceAddPageFolderSubscription = {
  pageFolder: PageFolder;
};

const SpaceAddPageFolderSubscription = gql`
  subscription ($environment: String!) {
    SpaceAddPageFolder(environment: $environment) {
      pageFolder {
        id
        name
        slug
        parentId
      }
    }
  }
`;

export default SpaceAddPageFolderSubscription;

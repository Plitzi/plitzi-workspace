// Packages
import { gql } from '@apollo/client/core';

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

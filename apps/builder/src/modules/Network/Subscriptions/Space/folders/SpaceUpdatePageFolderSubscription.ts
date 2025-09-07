import { gql } from '@apollo/client/core';

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

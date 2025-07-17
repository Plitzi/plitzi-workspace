// Packages
import { gql } from '@apollo/client/core';

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

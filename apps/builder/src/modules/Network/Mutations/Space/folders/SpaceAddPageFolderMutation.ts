import { gql } from '@apollo/client/core';

const SpaceAddPageFolderMutation = gql`
  mutation SpaceAddPageFolderMutation($environment: String!, $name: String!, $slug: String!, $parentId: String) {
    SpaceAddPageFolder(environment: $environment, name: $name, slug: $slug, parentId: $parentId) {
      id
      name
      slug
      parentId
    }
  }
`;

export default SpaceAddPageFolderMutation;
